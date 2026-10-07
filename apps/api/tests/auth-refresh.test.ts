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
import { RefreshSessionUseCase } from "../src/application/use-cases/refresh-session.js";
import { RegisterUserUseCase } from "../src/application/use-cases/register-user.js";
import { User } from "../src/domain/entities/user.js";
import { IdentityProviderUnavailableError } from "../src/domain/errors/identity-provider-unavailable-error.js";
import {
	REFRESH_TOKEN_REJECTED_MESSAGE,
	RefreshTokenRejectedError,
} from "../src/domain/errors/refresh-token-rejected-error.js";
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
import { AUTH_REFRESH_RATE_LIMIT } from "../src/interfaces/http/middlewares/rate-limit.js";

const ACCESS_TOKEN = "fresh-access-token";
const OLD_REFRESH_TOKEN = "old-refresh-token";
const NEW_REFRESH_TOKEN = "new-refresh-token";
const EXPIRES_IN = 3600;

class FakeIdentityProvider implements IdentityProvider {
	refreshResult: IdentityTokens | Error = {
		accessToken: ACCESS_TOKEN,
		refreshToken: NEW_REFRESH_TOKEN,
		expiresIn: EXPIRES_IN,
	};
	refreshCalls: string[] = [];

	async exchangePasswordCredentials(
		_credentials: IdentityProviderCredentials,
	): Promise<IdentityTokens> {
		throw new Error("login not used in refresh tests");
	}

	async signUp(_credentials: IdentityProviderCredentials): Promise<void> {
		// Not exercised by the refresh tests.
	}

	async getIdentity(_accessToken: string): Promise<Identity> {
		throw new Error("identity not used in refresh tests");
	}

	async refreshTokens(refreshToken: string): Promise<IdentityTokens> {
		this.refreshCalls.push(refreshToken);
		if (this.refreshResult instanceof Error) {
			throw this.refreshResult;
		}
		return this.refreshResult as IdentityTokens;
	}
}

class FakeUserRepository implements UserRepository {
	async upsertFromIdentity(identity: UserIdentity): Promise<User> {
		return User.create(identity);
	}

	async findByAuth0Sub(_auth0Sub: string): Promise<User | null> {
		return null;
	}
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
	cookieOptions?: Partial<AuthCookieOptions>;
}) {
	const companyRepository = new InMemoryCompanyRepository();
	const userRepository = new FakeUserRepository();

	return buildApp({
		createCompany: new CreateCompanyUseCase({ companyRepository }),
		listCompanies: new ListCompaniesUseCase({ companyRepository }),
		loginWithCredentials: new LoginWithCredentialsUseCase({
			identityProvider: options.provider,
			userRepository,
		}),
		registerUser: new RegisterUserUseCase({
			identityProvider: options.provider,
		}),
		refreshSession: new RefreshSessionUseCase({
			identityProvider: options.provider,
		}),
		requireAuth: passthroughAuth,
		requireUser: passthroughAuth,
		authCookieOptions: { ...defaultCookieOptions, ...options.cookieOptions },
		corsOrigin: "http://localhost:3000",
	});
}

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

describe("POST /auth/refresh", () => {
	it("reads the cookie, exchanges it, returns fresh tokens, and rotates the cookie", async () => {
		const provider = new FakeIdentityProvider();

		const response = await request(createTestApp({ provider }))
			.post("/auth/refresh")
			.set("Cookie", `${REFRESH_TOKEN_COOKIE_NAME}=${OLD_REFRESH_TOKEN}`);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			accessToken: ACCESS_TOKEN,
			expiresIn: EXPIRES_IN,
		});
		// The provider received exactly the token that was in the cookie.
		expect(provider.refreshCalls).toEqual([OLD_REFRESH_TOKEN]);

		const cookies = response.headers["set-cookie"] as string[] | undefined;
		expect(cookies).toBeDefined();
		expect(cookies).toHaveLength(1);
		expect(cookies[0]).toContain(
			`${REFRESH_TOKEN_COOKIE_NAME}=${NEW_REFRESH_TOKEN}`,
		);
		expect(cookies[0]).toContain("Path=/auth");
		expect(cookies[0]).toContain("HttpOnly");
		expect(cookies[0]).toContain("SameSite=Lax");
	});

	it("omits Set-Cookie when the provider does not rotate the refresh token", async () => {
		const provider = new FakeIdentityProvider();
		provider.refreshResult = {
			accessToken: ACCESS_TOKEN,
			expiresIn: EXPIRES_IN,
		};

		const response = await request(createTestApp({ provider }))
			.post("/auth/refresh")
			.set("Cookie", `${REFRESH_TOKEN_COOKIE_NAME}=${OLD_REFRESH_TOKEN}`);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			accessToken: ACCESS_TOKEN,
			expiresIn: EXPIRES_IN,
		});
		expect(response.headers["set-cookie"]).toBeUndefined();
	});

	it("returns 401 with the uniform message when the cookie is absent", async () => {
		const response = await request(
			createTestApp({ provider: new FakeIdentityProvider() }),
		).post("/auth/refresh");

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			error: { message: REFRESH_TOKEN_REJECTED_MESSAGE },
		});
	});

	it("returns the same 401 body and clears the cookie when the provider rejects it", async () => {
		const rejectedProvider = new FakeIdentityProvider();
		rejectedProvider.refreshResult = new RefreshTokenRejectedError();

		const noCookie = await request(
			createTestApp({ provider: new FakeIdentityProvider() }),
		).post("/auth/refresh");

		const rejected = await request(
			createTestApp({ provider: rejectedProvider }),
		)
			.post("/auth/refresh")
			.set("Cookie", `${REFRESH_TOKEN_COOKIE_NAME}=${OLD_REFRESH_TOKEN}`);

		expect(rejected.status).toBe(401);
		expect(rejected.body).toEqual(noCookie.body);

		const cookies = rejected.headers["set-cookie"] as string[] | undefined;
		expect(cookies).toBeDefined();
		expect(cookies[0]).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=;`);
		expect(cookies[0]).toContain("Path=/auth");
	});

	it("returns 503 for an unavailable provider, distinct from 401", async () => {
		const provider = new FakeIdentityProvider();
		provider.refreshResult = new IdentityProviderUnavailableError();

		const response = await request(createTestApp({ provider }))
			.post("/auth/refresh")
			.set("Cookie", `${REFRESH_TOKEN_COOKIE_NAME}=${OLD_REFRESH_TOKEN}`);

		expect(response.status).toBe(503);
		expect(response.status).not.toBe(401);
		expect(response.body).toEqual({
			error: { message: "Identity provider unavailable" },
		});
	});

	it("returns 429 once the configured refresh attempts are exceeded", async () => {
		const app = createTestApp({ provider: new FakeIdentityProvider() });

		for (let attempt = 0; attempt < AUTH_REFRESH_RATE_LIMIT; attempt++) {
			const response = await request(app)
				.post("/auth/refresh")
				.set("Cookie", `${REFRESH_TOKEN_COOKIE_NAME}=${OLD_REFRESH_TOKEN}`);
			expect(response.status).toBe(200);
		}

		const exceeded = await request(app)
			.post("/auth/refresh")
			.set("Cookie", `${REFRESH_TOKEN_COOKIE_NAME}=${OLD_REFRESH_TOKEN}`);

		expect(exceeded.status).toBe(429);
	});

	it("never logs the refresh or access token, on success or rejection", async () => {
		const spies = captureConsole();

		const success = await request(
			createTestApp({ provider: new FakeIdentityProvider() }),
		)
			.post("/auth/refresh")
			.set("Cookie", `${REFRESH_TOKEN_COOKIE_NAME}=${OLD_REFRESH_TOKEN}`);
		expect(success.status).toBe(200);

		const rejectedProvider = new FakeIdentityProvider();
		rejectedProvider.refreshResult = new RefreshTokenRejectedError();
		const failure = await request(createTestApp({ provider: rejectedProvider }))
			.post("/auth/refresh")
			.set("Cookie", `${REFRESH_TOKEN_COOKIE_NAME}=${OLD_REFRESH_TOKEN}`);
		expect(failure.status).toBe(401);

		const output = spies.output();
		expect(output).not.toContain(OLD_REFRESH_TOKEN);
		expect(output).not.toContain(NEW_REFRESH_TOKEN);
		expect(output).not.toContain(ACCESS_TOKEN);
		spies.restore();
	});
});
