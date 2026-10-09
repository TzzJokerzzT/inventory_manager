import type {
	Identity,
	IdentityProvider,
	IdentityProviderCredentials,
	IdentityTokens,
} from "../../application/ports/identity-provider.js";
import { IdentityProviderUnavailableError } from "../../domain/errors/identity-provider-unavailable-error.js";
import { InvalidCredentialsError } from "../../domain/errors/invalid-credentials-error.js";
import { RefreshTokenRejectedError } from "../../domain/errors/refresh-token-rejected-error.js";
import { SignUpRejectedError } from "../../domain/errors/sign-up-rejected-error.js";

/**
 * Scope sent explicitly on every token exchange.
 *
 * The explicit scope is load-bearing, not cosmetic: Auth0's documented
 * behaviour is that omitting `scope` yields an access token carrying every
 * scope of the API. `offline_access` is what makes Auth0 return a refresh
 * token, so it is part of the minimum.
 */
const MINIMAL_SCOPE = "openid profile email offline_access";

/**
 * Abort an upstream Auth0 call that hangs: the API runs as a serverless
 * function (`docs/stack.md` §5.2) where a stuck upstream call consumes the
 * function's execution budget (~10 s on low plans). Five seconds leaves
 * headroom for the handler to respond.
 */
const UPSTREAM_TIMEOUT_MS = 5_000;

export interface Auth0IdentityProviderDependencies {
	/** Base URL of the issuer, with a trailing slash, e.g. `https://tenant.us.auth0.com/`. */
	issuerBaseURL: string;
	clientId: string;
	clientSecret: string;
	audience: string;
	/** The Auth0 database connection name, sent as the `realm` parameter. */
	connection: string;
}

interface Auth0ErrorBody {
	error?: unknown;
	error_description?: unknown;
}

interface Auth0SignUpErrorBody {
	code?: unknown;
	description?: unknown;
}

interface Auth0UserInfoResponse {
	sub?: unknown;
	email?: unknown;
	email_verified?: unknown;
}

interface Auth0TokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
}

/**
 * Auth0-backed adapter for the {@link IdentityProvider} port.
 *
 * Configuration is constructor-injected, mirroring how the Prisma adapter
 * takes its client: the composition root owns configuration and `env` is never
 * read here. The request body and the credentials are never logged; only the
 * provider's error code and description are, so a disabled grant
 * (`unauthorized_client`) can be told apart from wrong credentials
 * (`invalid_grant`) in the server logs — the two are identical to the caller
 * by design.
 */
export class Auth0IdentityProvider implements IdentityProvider {
	private readonly issuerBaseURL: string;
	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly audience: string;
	private readonly connection: string;

	constructor(dependencies: Auth0IdentityProviderDependencies) {
		this.issuerBaseURL = dependencies.issuerBaseURL;
		this.clientId = dependencies.clientId;
		this.clientSecret = dependencies.clientSecret;
		this.audience = dependencies.audience;
		this.connection = dependencies.connection;
	}

	async exchangePasswordCredentials(
		credentials: IdentityProviderCredentials,
	): Promise<IdentityTokens> {
		const url = `${this.issuerBaseURL}oauth/token`;
		const body = new URLSearchParams({
			grant_type: "password",
			username: credentials.email,
			password: credentials.password,
			client_id: this.clientId,
			client_secret: this.clientSecret,
			audience: this.audience,
			scope: MINIMAL_SCOPE,
			realm: this.connection,
		});

		let response: Response;
		try {
			response = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: body.toString(),
				signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			});
		} catch {
			// Network failure or timeout: no provider response arrived. The
			// rejection reason is deliberately not logged so the request body
			// (and with it the password) can never leak.
			console.error("Auth0 token exchange failed: no response received");
			throw new IdentityProviderUnavailableError();
		}

		if (!response.ok) {
			const { code, description } = await readErrorDetail(response);
			// Log only the provider's error code and description. The request
			// body is never logged. This is also the only place where
			// `unauthorized_client` (the grant is disabled — our
			// misconfiguration) and `invalid_grant` (wrong credentials) can be
			// told apart: they are identical to the caller by design.
			console.error(
				`Auth0 token exchange failed: ${code}${description ? ` — ${description}` : ""}`,
			);

			if (response.status >= 400 && response.status < 500) {
				throw new InvalidCredentialsError();
			}
			throw new IdentityProviderUnavailableError();
		}

		const payload = (await response.json()) as Auth0TokenResponse;

		// Never trust the upstream shape: a 200 missing `access_token` or
		// `expires_in` must not resolve silently as a success with `undefined`
		// fields — the endpoint would answer 200 with no token. The failure has
		// to be loud, so it is mapped to the same "provider unavailable" the
		// caller already understands (503).
		if (
			typeof payload.access_token !== "string" ||
			typeof payload.expires_in !== "number"
		) {
			console.error(
				"Auth0 token exchange succeeded but returned an unexpected shape",
			);
			throw new IdentityProviderUnavailableError();
		}

		return {
			accessToken: payload.access_token,
			...(payload.refresh_token ? { refreshToken: payload.refresh_token } : {}),
			expiresIn: payload.expires_in,
		};
	}

	async refreshTokens(refreshToken: string): Promise<IdentityTokens> {
		const url = `${this.issuerBaseURL}oauth/token`;
		const body = new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: this.clientId,
			client_secret: this.clientSecret,
			audience: this.audience,
			scope: MINIMAL_SCOPE,
		});

		let response: Response;
		try {
			response = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: body.toString(),
				signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			});
		} catch {
			// Network failure or timeout: no provider response arrived. The
			// rejection reason is deliberately not logged so the refresh token
			// (a credential) can never leak.
			console.error("Auth0 refresh failed: no response received");
			throw new IdentityProviderUnavailableError();
		}

		if (!response.ok) {
			const { code, description } = await readErrorDetail(response);
			// Log only the provider's error code and description. The refresh
			// token is never logged.
			console.error(
				`Auth0 refresh failed: ${code}${description ? ` — ${description}` : ""}`,
			);

			if (response.status >= 400 && response.status < 500) {
				throw new RefreshTokenRejectedError();
			}
			throw new IdentityProviderUnavailableError();
		}

		const payload = (await response.json()) as Auth0TokenResponse;

		// Never trust the upstream shape: a 200 missing `access_token` or
		// `expires_in` must not resolve silently as a success — it is mapped to
		// the same "provider unavailable" the caller already understands (503).
		if (
			typeof payload.access_token !== "string" ||
			typeof payload.expires_in !== "number"
		) {
			console.error("Auth0 refresh succeeded but returned an unexpected shape");
			throw new IdentityProviderUnavailableError();
		}

		return {
			accessToken: payload.access_token,
			...(payload.refresh_token ? { refreshToken: payload.refresh_token } : {}),
			expiresIn: payload.expires_in,
		};
	}

	async signUp(credentials: IdentityProviderCredentials): Promise<void> {
		const url = `${this.issuerBaseURL}dbconnections/signup`;
		const body = JSON.stringify({
			client_id: this.clientId,
			email: credentials.email,
			password: credentials.password,
			connection: this.connection,
		});

		let response: Response;
		try {
			response = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body,
				signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			});
		} catch {
			// Network failure or timeout: no provider response arrived. The
			// rejection reason is deliberately not logged so the request body
			// (and with it the password) can never leak.
			console.error("Auth0 sign up failed: no response received");
			throw new IdentityProviderUnavailableError();
		}

		if (!response.ok) {
			const { code, description } = await readSignUpErrorDetail(response);
			// Log only the provider's error code and description. The request
			// body is never logged. A 4xx here is expected and meaningful:
			// Auth0 answers `invalid_signup` both for a duplicate email and for
			// a rejected password, and deliberately does not say which.
			console.error(
				`Auth0 sign up rejected: ${code}${description ? ` — ${description}` : ""}`,
			);

			if (response.status >= 400 && response.status < 500) {
				throw new SignUpRejectedError();
			}
			throw new IdentityProviderUnavailableError();
		}

		// The response body is deliberately not read: the caller gets a
		// uniform response regardless of what Auth0 answered.
	}

	async getIdentity(accessToken: string): Promise<Identity> {
		const url = `${this.issuerBaseURL}userinfo`;

		let response: Response;
		try {
			response = await fetch(url, {
				method: "GET",
				headers: { authorization: `Bearer ${accessToken}` },
				signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			});
		} catch {
			// Network failure or timeout: the access token is a credential and
			// must never be logged.
			console.error("Auth0 userinfo request failed: no response received");
			throw new IdentityProviderUnavailableError();
		}

		if (!response.ok) {
			const { code, description } = await readErrorDetail(response);
			// The person already authenticated successfully, so a failure to
			// read the profile is our problem, not "invalid credentials". Only
			// the provider's error code and description are logged; the access
			// token is never logged.
			console.error(
				`Auth0 userinfo request failed: ${code}${description ? ` — ${description}` : ""}`,
			);
			throw new IdentityProviderUnavailableError();
		}

		const payload = (await response.json()) as Auth0UserInfoResponse;

		// Never trust the upstream shape: a 200 missing `sub` or `email` must
		// not resolve as an identity with `undefined` fields. It is mapped to
		// the same "provider unavailable" the caller already understands.
		if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
			console.error(
				"Auth0 userinfo succeeded but returned an unexpected shape",
			);
			throw new IdentityProviderUnavailableError();
		}

		return {
			auth0Sub: payload.sub,
			email: payload.email,
			// Absence of proof is not proof: a missing (or non-boolean)
			// `email_verified` is treated as false.
			emailVerified: payload.email_verified === true,
		};
	}
}

async function readErrorDetail(
	response: Response,
): Promise<{ code: string; description: string }> {
	try {
		const body = (await response.json()) as Auth0ErrorBody;
		return {
			code:
				typeof body.error === "string" ? body.error : String(response.status),
			description:
				typeof body.error_description === "string"
					? body.error_description
					: "",
		};
	} catch {
		return { code: String(response.status), description: "" };
	}
}

async function readSignUpErrorDetail(
	response: Response,
): Promise<{ code: string; description: string }> {
	try {
		// The signup endpoint uses Auth0's `code`/`description` shape, unlike
		// the OAuth2 token and userinfo endpoints which use
		// `error`/`error_description`.
		const body = (await response.json()) as Auth0SignUpErrorBody;
		return {
			code: typeof body.code === "string" ? body.code : String(response.status),
			description: typeof body.description === "string" ? body.description : "",
		};
	} catch {
		return { code: String(response.status), description: "" };
	}
}
