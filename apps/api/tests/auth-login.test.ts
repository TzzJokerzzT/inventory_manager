import type { RequestHandler } from "express";
import request from "supertest";
import type {
	Identity,
	IdentityProvider,
	IdentityProviderCredentials,
	IdentityTokens,
} from "../src/application/ports/identity-provider.js";
import { CreateCompanyUseCase } from "../src/application/use-cases/create-company.js";
import { ListCompaniesUseCase } from "../src/application/use-cases/list-companies.js";
import { LoginWithCredentialsUseCase } from "../src/application/use-cases/login-with-credentials.js";
import { RegisterUserUseCase } from "../src/application/use-cases/register-user.js";
import { User } from "../src/domain/entities/user.js";
import { IdentityProviderUnavailableError } from "../src/domain/errors/identity-provider-unavailable-error.js";
import { InvalidCredentialsError } from "../src/domain/errors/invalid-credentials-error.js";
import type {
	UserIdentity,
	UserRepository,
} from "../src/domain/repositories/user-repository.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { buildApp } from "../src/interfaces/http/app.js";
import {
	type AuthCookieOptions,
	REFRESH_TOKEN_COOKIE_NAME,
	REFRESH_TOKEN_MAX_AGE_MS,
} from "../src/interfaces/http/controllers/auth-controller.js";
import { AUTH_LOGIN_RATE_LIMIT } from "../src/interfaces/http/middlewares/rate-limit.js";

const EMAIL = "someone@example.com";
const PASSWORD = "SUPERSECRET-PASSWORD-123";
const ACCESS_TOKEN = "access-token-value";
const REFRESH_TOKEN = "refresh-token-value";
const EXPIRES_IN = 3600;

/** Identity reported by `/userinfo` after the credential exchange succeeds. */
const AUTH0_SUB = "auth0|userinfo-sub-123";
const IDENTITY_EMAIL = "Verified.User@Example.com";

/**
 * Success payload carrying fields Auth0 would also return (`id_token`,
 * `scope`). They must never cross the HTTP boundary: the controller picks the
 * exact two response fields, so the test proves no provider field leaks.
 */
const SUCCESS_WITH_EXTRA_FIELDS = {
	accessToken: ACCESS_TOKEN,
	refreshToken: REFRESH_TOKEN,
	expiresIn: EXPIRES_IN,
	idToken: "must-not-leak",
	scope: "must-not-leak",
};

class FakeIdentityProvider implements IdentityProvider {
	calls: IdentityProviderCredentials[] = [];
	result: unknown = SUCCESS_WITH_EXTRA_FIELDS;
	identity: Identity | Error = {
		auth0Sub: AUTH0_SUB,
		email: IDENTITY_EMAIL,
		emailVerified: true,
	};
	getIdentityCalls: string[] = [];

	async exchangePasswordCredentials(
		credentials: IdentityProviderCredentials,
	): Promise<IdentityTokens> {
		this.calls.push(credentials);
		if (this.result instanceof Error) {
			throw this.result;
		}
		return this.result as IdentityTokens;
	}

	async signUp(_credentials: IdentityProviderCredentials): Promise<void> {
		// Not exercised by the login tests.
	}

	async getIdentity(accessToken: string): Promise<Identity> {
		this.getIdentityCalls.push(accessToken);
		if (this.identity instanceof Error) {
			throw this.identity;
		}
		return this.identity;
	}
}

/**
 * Records what the login use case asked to persist, so the gate tests can
 * assert both the values (from `/userinfo`, not the login input) and the
 * absence of a call when the email is unverified.
 */
class FakeUserRepository implements UserRepository {
	upsertCalls: UserIdentity[] = [];

	async upsertFromIdentity(identity: UserIdentity): Promise<User> {
		this.upsertCalls.push(identity);
		return User.create(identity);
	}

	async findByAuth0Sub(_auth0Sub: string): Promise<User | null> {
		return null;
	}
}

function providerThrowing(error: Error): FakeIdentityProvider {
	const provider = new FakeIdentityProvider();
	provider.result = error;
	return provider;
}

const passthroughAuth: RequestHandler = (_request, _response, next) => {
	next();
};

const defaultCookieOptions: AuthCookieOptions = {
	httpOnly: true,
	secure: false,
	sameSite: "lax",
	path: "/auth",
	maxAge: REFRESH_TOKEN_MAX_AGE_MS,
};

function createTestApp(options: {
	provider: IdentityProvider;
	userRepository?: UserRepository;
	registerUser?: RegisterUserUseCase;
	cookieOptions?: Partial<AuthCookieOptions>;
}) {
	const companyRepository = new InMemoryCompanyRepository();
	const userRepository = options.userRepository ?? new FakeUserRepository();

	return buildApp({
		createCompany: new CreateCompanyUseCase({ companyRepository }),
		listCompanies: new ListCompaniesUseCase({ companyRepository }),
		loginWithCredentials: new LoginWithCredentialsUseCase({
			identityProvider: options.provider,
			userRepository,
		}),
		registerUser:
			options.registerUser ??
			new RegisterUserUseCase({ identityProvider: options.provider }),
		requireAuth: passthroughAuth,
		authCookieOptions: { ...defaultCookieOptions, ...options.cookieOptions },
		corsOrigin: TEST_WEB_ORIGIN,
	});
}

const TEST_WEB_ORIGIN = "http://localhost:3000";

const CONSOLE_METHODS = [
	"log",
	"error",
	"warn",
	"info",
	"debug",
	"trace",
] as const;

function captureConsole() {
	const spies = CONSOLE_METHODS.map((method) =>
		jest.spyOn(console, method).mockImplementation(() => {}),
	);

	return {
		output(): string {
			return spies
				.flatMap((spy) => spy.mock.calls)
				.map((args) => args.map((arg) => String(arg)).join(" "))
				.join("\n");
		},
		restore(): void {
			spies.forEach((spy) => {
				spy.mockRestore();
			});
		},
	};
}

afterEach(() => {
	jest.restoreAllMocks();
});

describe("LoginWithCredentialsUseCase", () => {
	it("trims the email without lowercasing it before delegating to the port", async () => {
		const provider = new FakeIdentityProvider();
		const useCase = new LoginWithCredentialsUseCase({
			identityProvider: provider,
			userRepository: new FakeUserRepository(),
		});

		await useCase.execute({
			email: "  SomeOne@Example.COM  ",
			password: PASSWORD,
		});

		expect(provider.calls).toHaveLength(1);
		expect(provider.calls[0].email).toBe("SomeOne@Example.COM");
		expect(provider.calls[0].password).toBe(PASSWORD);
	});
});

describe("POST /auth/login", () => {
	it("returns the access token, expiry, and an httpOnly refresh cookie", async () => {
		const response = await request(
			createTestApp({ provider: new FakeIdentityProvider() }),
		)
			.post("/auth/login")
			.send({ email: EMAIL, password: PASSWORD });

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			accessToken: ACCESS_TOKEN,
			expiresIn: EXPIRES_IN,
		});

		const cookies = response.headers["set-cookie"] as string[] | undefined;
		expect(cookies).toBeDefined();
		expect(cookies).toHaveLength(1);
		const cookie = cookies[0];
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("Path=/auth");
		expect(cookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=${REFRESH_TOKEN}`);
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).not.toContain("Secure");
	});

	it("marks the cookie Secure when the injected options are production-mode", async () => {
		const response = await request(
			createTestApp({
				provider: new FakeIdentityProvider(),
				cookieOptions: { secure: true },
			}),
		)
			.post("/auth/login")
			.send({ email: EMAIL, password: PASSWORD });

		expect(response.status).toBe(200);
		const cookies = response.headers["set-cookie"] as string[] | undefined;
		expect(cookies).toBeDefined();
		expect(cookies[0]).toContain("Secure");
	});

	it("returns 401 for invalid credentials", async () => {
		const response = await request(
			createTestApp({
				provider: providerThrowing(new InvalidCredentialsError()),
			}),
		)
			.post("/auth/login")
			.send({ email: EMAIL, password: "wrong-password" });

		expect(response.status).toBe(401);
	});

	it("returns the same 401 body for an unknown email (uniformity by comparison)", async () => {
		const invalid = await request(
			createTestApp({
				provider: providerThrowing(new InvalidCredentialsError()),
			}),
		)
			.post("/auth/login")
			.send({ email: "known@example.com", password: "wrong-password" });

		const unknown = await request(
			createTestApp({
				provider: providerThrowing(new InvalidCredentialsError()),
			}),
		)
			.post("/auth/login")
			.send({ email: "unknown@example.com", password: "any-password" });

		expect(invalid.status).toBe(401);
		expect(unknown.status).toBe(401);
		expect(unknown.body).toEqual(invalid.body);
	});

	it("returns 400 for a malformed payload", async () => {
		const app = createTestApp({ provider: new FakeIdentityProvider() });

		const badEmail = await request(app)
			.post("/auth/login")
			.send({ email: "not-an-email", password: "password" });
		expect(badEmail.status).toBe(400);

		const missingPassword = await request(app)
			.post("/auth/login")
			.send({ email: EMAIL });
		expect(missingPassword.status).toBe(400);
	});

	it("returns 503 for an unavailable provider, distinct from 401", async () => {
		const response = await request(
			createTestApp({
				provider: providerThrowing(new IdentityProviderUnavailableError()),
			}),
		)
			.post("/auth/login")
			.send({ email: EMAIL, password: PASSWORD });

		expect(response.status).toBe(503);
		expect(response.status).not.toBe(401);
		expect(response.body).toEqual({
			error: { message: "Identity provider unavailable" },
		});
	});

	it("returns 429 once the configured login attempts are exceeded", async () => {
		const app = createTestApp({ provider: new FakeIdentityProvider() });

		for (let attempt = 0; attempt < AUTH_LOGIN_RATE_LIMIT; attempt++) {
			const response = await request(app)
				.post("/auth/login")
				.send({ email: EMAIL, password: PASSWORD });
			expect(response.status).toBe(200);
		}

		const exceeded = await request(app)
			.post("/auth/login")
			.send({ email: EMAIL, password: PASSWORD });

		expect(exceeded.status).toBe(429);
	});

	it("never logs the password on a successful or failed login", async () => {
		const spies = captureConsole();

		const success = await request(
			createTestApp({ provider: new FakeIdentityProvider() }),
		)
			.post("/auth/login")
			.send({ email: EMAIL, password: PASSWORD });
		expect(success.status).toBe(200);

		const failure = await request(
			createTestApp({
				provider: providerThrowing(new InvalidCredentialsError()),
			}),
		)
			.post("/auth/login")
			.send({ email: EMAIL, password: PASSWORD });
		expect(failure.status).toBe(401);

		expect(spies.output()).not.toContain(PASSWORD);
		spies.restore();
	});

	it("omits the Set-Cookie when the provider returns no refresh token", async () => {
		const provider = new FakeIdentityProvider();
		provider.result = { accessToken: ACCESS_TOKEN, expiresIn: EXPIRES_IN };

		const response = await request(createTestApp({ provider }))
			.post("/auth/login")
			.send({ email: EMAIL, password: PASSWORD });

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			accessToken: ACCESS_TOKEN,
			expiresIn: EXPIRES_IN,
		});
		expect(response.headers["set-cookie"]).toBeUndefined();
	});
});

describe("POST /auth/login email_verified gate", () => {
	it("returns 403 email_not_verified with no tokens, no cookie and no user row", async () => {
		const provider = new FakeIdentityProvider();
		provider.identity = {
			auth0Sub: AUTH0_SUB,
			email: IDENTITY_EMAIL,
			emailVerified: false,
		};
		const userRepository = new FakeUserRepository();

		const response = await request(createTestApp({ provider, userRepository }))
			.post("/auth/login")
			.send({ email: EMAIL, password: PASSWORD });

		expect(response.status).toBe(403);
		expect(response.body).toEqual({
			error: { message: "Email not verified", code: "email_not_verified" },
		});
		expect(response.body.accessToken).toBeUndefined();
		expect(response.body.expiresIn).toBeUndefined();
		expect(response.headers["set-cookie"]).toBeUndefined();
		expect(userRepository.upsertCalls).toHaveLength(0);
	});

	it("upserts the row from the /userinfo identity and returns tokens for a verified email", async () => {
		const provider = new FakeIdentityProvider();
		const userRepository = new FakeUserRepository();

		const response = await request(createTestApp({ provider, userRepository }))
			.post("/auth/login")
			.send({ email: EMAIL, password: PASSWORD });

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			accessToken: ACCESS_TOKEN,
			expiresIn: EXPIRES_IN,
		});

		// The access token issued by the exchange is what the use case reads
		// back with `/userinfo`.
		expect(provider.getIdentityCalls).toEqual([ACCESS_TOKEN]);

		// The persisted identity comes from `/userinfo`, not from the login
		// input (different email and sub by construction).
		expect(userRepository.upsertCalls).toHaveLength(1);
		expect(userRepository.upsertCalls[0]).toEqual({
			auth0Sub: AUTH0_SUB,
			email: IDENTITY_EMAIL,
		});

		const cookies = response.headers["set-cookie"] as string[] | undefined;
		expect(cookies).toBeDefined();
		expect(cookies[0]).toContain(
			`${REFRESH_TOKEN_COOKIE_NAME}=${REFRESH_TOKEN}`,
		);
	});

	it("returns 503 when /userinfo fails after a successful credential exchange", async () => {
		const provider = new FakeIdentityProvider();
		provider.identity = new IdentityProviderUnavailableError();
		const userRepository = new FakeUserRepository();

		const response = await request(createTestApp({ provider, userRepository }))
			.post("/auth/login")
			.send({ email: EMAIL, password: PASSWORD });

		expect(response.status).toBe(503);
		expect(response.body).toEqual({
			error: { message: "Identity provider unavailable" },
		});
		expect(userRepository.upsertCalls).toHaveLength(0);
	});
});
