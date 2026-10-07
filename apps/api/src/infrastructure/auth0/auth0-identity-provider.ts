import type {
	IdentityProvider,
	IdentityProviderCredentials,
	IdentityTokens,
} from "../../application/ports/identity-provider.js";
import { IdentityProviderUnavailableError } from "../../domain/errors/identity-provider-unavailable-error.js";
import { InvalidCredentialsError } from "../../domain/errors/invalid-credentials-error.js";

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
 * Abort a token exchange that hangs: the API runs as a serverless function
 * (`docs/stack.md` §5.2) where a stuck upstream call consumes the function's
 * execution budget (~10 s on low plans). Five seconds leaves headroom for the
 * handler to respond.
 */
const TOKEN_EXCHANGE_TIMEOUT_MS = 5_000;

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
				signal: AbortSignal.timeout(TOKEN_EXCHANGE_TIMEOUT_MS),
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
