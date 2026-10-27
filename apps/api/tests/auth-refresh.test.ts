import type { RequestHandler } from "express";
import request from "supertest";
import type {
	Identity,
	IdentityProvider,
	IdentityProviderCredentials,
	IdentityTokens,
} from "../src/application/ports/identity-provider.js";
import { hashRefreshToken } from "../src/application/session-token-hash.js";
import { CreateCompanyUseCase } from "../src/application/use-cases/create-company.js";
import { EndSessionUseCase } from "../src/application/use-cases/end-session.js";
import { ListCompaniesUseCase } from "../src/application/use-cases/list-companies.js";
import { LoginWithCredentialsUseCase } from "../src/application/use-cases/login-with-credentials.js";
import { RefreshSessionUseCase } from "../src/application/use-cases/refresh-session.js";
import { RegisterUserUseCase } from "../src/application/use-cases/register-user.js";
import { ResumeSessionUseCase } from "../src/application/use-cases/resume-session.js";
import { StartSessionUseCase } from "../src/application/use-cases/start-session.js";
import { Session } from "../src/domain/entities/session.js";
import { IdentityProviderUnavailableError } from "../src/domain/errors/identity-provider-unavailable-error.js";
import {
	REFRESH_TOKEN_REJECTED_MESSAGE,
	RefreshTokenRejectedError,
} from "../src/domain/errors/refresh-token-rejected-error.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemorySessionRepository } from "../src/infrastructure/database/in-memory-session-repository.js";
import { buildApp } from "../src/interfaces/http/app.js";
import {
	type AuthCookieOptions,
	REFRESH_TOKEN_COOKIE_NAME,
	REFRESH_TOKEN_MAX_AGE_MS,
	SESSION_COOKIE_NAME,
} from "../src/interfaces/http/controllers/auth-controller.js";
import { AUTH_REFRESH_RATE_LIMIT } from "../src/interfaces/http/middlewares/rate-limit.js";
import { createFakeUserRepository } from "./support/fake-user-repository.js";
import { responseCookies } from "./support/response-cookies.js";

const ACCESS_TOKEN = "fresh-access-token";
const OLD_REFRESH_TOKEN = "old-refresh-token";
const NEW_REFRESH_TOKEN = "new-refresh-token";
const EXPIRES_IN = 3600;
const SESSION_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "55555555-5555-4555-8555-555555555555";
/** Fixed "now": the seeded session is active at this instant and no test sleeps. */
const NOW = new Date("2026-01-01T00:00:00.000Z");
/** Wide enough that every test in this file works on a live session. */
const LIVE_IDLE_TIMEOUT_MS = REFRESH_TOKEN_MAX_AGE_MS;

/**
 * The pair the browser sends once a session exists. Both cookies are required:
 * the refresh token alone is no longer exchangeable, which is what makes the
 * server-side session revocable.
 */
function sessionCookies(refreshToken: string = OLD_REFRESH_TOKEN): string {
	return `${REFRESH_TOKEN_COOKIE_NAME}=${refreshToken}; ${SESSION_COOKIE_NAME}=${SESSION_ID}`;
}

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
	const userRepository = createFakeUserRepository();
	const sessionRepository = new InMemorySessionRepository([
		Session.create({
			id: SESSION_ID,
			userId: USER_ID,
			createdAt: NOW,
			refreshTokenHash: hashRefreshToken(OLD_REFRESH_TOKEN),
		}),
	]);

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
		startSession: new StartSessionUseCase({
			sessionRepository,
			clock: () => NOW,
		}),
		resumeSession: new ResumeSessionUseCase({
			sessionRepository,
			idleTimeoutMs: LIVE_IDLE_TIMEOUT_MS,
			clock: () => NOW,
		}),
		endSession: new EndSessionUseCase({
			sessionRepository,
			clock: () => NOW,
		}),
		requireAuth: passthroughAuth,
		requireUser: passthroughAuth,
		requireCompanyContext: passthroughAuth,
		// The refresh slice never reaches these; the explicit `{} as never`
		// records that the wiring is intentionally inert rather than forgotten.
		acceptInvitations: {} as never,
		changeMemberRole: {} as never,
		getCurrentUser: {} as never,
		inviteMember: {} as never,
		leaveCompany: {} as never,
		listMembers: {} as never,
		listNotifications: {} as never,
		listPendingInvitations: {} as never,
		markNotificationsRead: {} as never,
		mediaUploadSigner: {} as never,
		revokeMember: {} as never,
		updateUserFullName: {} as never,
		customers: {} as never,
		products: {} as never,
		movements: {} as never,
		suppliers: {} as never,
		categories: {} as never,
		lots: {} as never,
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
			.set("Cookie", sessionCookies());

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			accessToken: ACCESS_TOKEN,
			expiresIn: EXPIRES_IN,
		});
		// The provider received exactly the token that was in the cookie.
		expect(provider.refreshCalls).toEqual([OLD_REFRESH_TOKEN]);

		const cookies = responseCookies(response.headers["set-cookie"]);
		expect(cookies).toBeDefined();
		// The rotated refresh cookie plus the session cookie, which slides with
		// every successful refresh so an active session never loses half of the
		// pair.
		expect(cookies).toHaveLength(2);
		expect(cookies?.[0]).toContain(
			`${REFRESH_TOKEN_COOKIE_NAME}=${NEW_REFRESH_TOKEN}`,
		);
		expect(cookies?.[0]).toContain("Path=/auth");
		expect(cookies?.[0]).toContain("HttpOnly");
		expect(cookies?.[0]).toContain("SameSite=Lax");
		expect(cookies?.[1]).toContain(`${SESSION_COOKIE_NAME}=${SESSION_ID}`);
	});

	it("re-sets only the session cookie when the provider does not rotate the refresh token", async () => {
		const provider = new FakeIdentityProvider();
		provider.refreshResult = {
			accessToken: ACCESS_TOKEN,
			expiresIn: EXPIRES_IN,
		};

		const response = await request(createTestApp({ provider }))
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			accessToken: ACCESS_TOKEN,
			expiresIn: EXPIRES_IN,
		});
		const cookies = responseCookies(response.headers["set-cookie"]);
		expect(cookies).toHaveLength(1);
		expect(cookies?.[0]).toContain(`${SESSION_COOKIE_NAME}=${SESSION_ID}`);
		expect(cookies?.[0]).not.toContain(REFRESH_TOKEN_COOKIE_NAME);
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
			.set("Cookie", sessionCookies());

		expect(rejected.status).toBe(401);
		expect(rejected.body).toEqual(noCookie.body);

		const cookies = responseCookies(rejected.headers["set-cookie"]);
		expect(cookies).toBeDefined();
		expect(cookies?.[0]).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=;`);
		expect(cookies?.[0]).toContain("Path=/auth");
	});

	it("returns 503 for an unavailable provider, distinct from 401", async () => {
		const provider = new FakeIdentityProvider();
		provider.refreshResult = new IdentityProviderUnavailableError();

		const response = await request(createTestApp({ provider }))
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());

		expect(response.status).toBe(503);
		expect(response.status).not.toBe(401);
		expect(response.body).toEqual({
			error: { message: "Identity provider unavailable" },
		});
	});

	it("returns 429 once the configured refresh attempts are exceeded", async () => {
		const app = createTestApp({ provider: new FakeIdentityProvider() });

		// Every successful exchange rotates the token and the session re-binds to
		// it, so the loop follows the cookie the browser would send next.
		let currentToken = OLD_REFRESH_TOKEN;
		for (let attempt = 0; attempt < AUTH_REFRESH_RATE_LIMIT; attempt++) {
			const response = await request(app)
				.post("/auth/refresh")
				.set("Cookie", sessionCookies(currentToken));
			expect(response.status).toBe(200);
			currentToken = NEW_REFRESH_TOKEN;
		}

		const exceeded = await request(app)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies(currentToken));

		expect(exceeded.status).toBe(429);
	});

	it("never logs the refresh or access token, on success or rejection", async () => {
		const spies = captureConsole();

		const success = await request(
			createTestApp({ provider: new FakeIdentityProvider() }),
		)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());
		expect(success.status).toBe(200);

		const rejectedProvider = new FakeIdentityProvider();
		rejectedProvider.refreshResult = new RefreshTokenRejectedError();
		const failure = await request(createTestApp({ provider: rejectedProvider }))
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());
		expect(failure.status).toBe(401);

		const output = spies.output();
		expect(output).not.toContain(OLD_REFRESH_TOKEN);
		expect(output).not.toContain(NEW_REFRESH_TOKEN);
		expect(output).not.toContain(ACCESS_TOKEN);
		spies.restore();
	});
});
