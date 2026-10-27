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
import { createFakeUserRepository } from "./support/fake-user-repository.js";
import { responseCookies } from "./support/response-cookies.js";

const ACCESS_TOKEN = "fresh-access-token";
const REFRESH_TOKEN = "old-refresh-token";
const NEW_REFRESH_TOKEN = "new-refresh-token";
const EXPIRES_IN = 3600;
const SESSION_ID = "66666666-6666-4666-8666-666666666666";
const USER_ID = "77777777-7777-4777-8777-777777777777";
/** Fixed "now": every assertion moves the clock by hand, no test sleeps. */
const NOW = new Date("2026-01-01T00:00:00.000Z");
/**
 * Three seconds: the whole point of the setting is that a window of days can be
 * exercised in milliseconds, so the suite pins a tiny one instead of waiting.
 */
const IDLE_TIMEOUT_MINUTES = 0.05;
const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60_000;

class FakeIdentityProvider implements IdentityProvider {
	refreshCalls: string[] = [];
	refreshResult: IdentityTokens | Error = {
		accessToken: ACCESS_TOKEN,
		refreshToken: NEW_REFRESH_TOKEN,
		expiresIn: EXPIRES_IN,
	};

	async exchangePasswordCredentials(
		_credentials: IdentityProviderCredentials,
	): Promise<IdentityTokens> {
		return {
			accessToken: ACCESS_TOKEN,
			refreshToken: REFRESH_TOKEN,
			expiresIn: EXPIRES_IN,
		};
	}

	async signUp(_credentials: IdentityProviderCredentials): Promise<void> {
		// Not exercised by the session tests.
	}

	async getIdentity(_accessToken: string): Promise<Identity> {
		return {
			auth0Sub: "auth0|session-user",
			email: "session@example.com",
			emailVerified: true,
		};
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

/** The pair the browser holds while a session is alive. */
function sessionCookies(refreshToken: string = REFRESH_TOKEN): string {
	return `${REFRESH_TOKEN_COOKIE_NAME}=${refreshToken}; ${SESSION_COOKIE_NAME}=${SESSION_ID}`;
}

function liveSession(lastActivityAt: Date = NOW): Session {
	return Session.create({
		id: SESSION_ID,
		userId: USER_ID,
		createdAt: NOW,
		lastActivityAt,
		// Bound to the token the browser holds, which is what makes the pair
		// exchangeable and everything else a rejection.
		refreshTokenHash: hashRefreshToken(REFRESH_TOKEN),
	});
}

function createTestApp(
	options: {
		sessions?: Session[];
		now?: () => Date;
		cookieOptions?: Partial<AuthCookieOptions>;
	} = {},
) {
	const companyRepository = new InMemoryCompanyRepository();
	const userRepository = createFakeUserRepository();
	const provider = new FakeIdentityProvider();
	const clock = options.now ?? (() => NOW);
	const sessionRepository = new InMemorySessionRepository(
		options.sessions ?? [liveSession()],
	);

	const app = buildApp({
		createCompany: new CreateCompanyUseCase({ companyRepository }),
		listCompanies: new ListCompaniesUseCase({ companyRepository }),
		loginWithCredentials: new LoginWithCredentialsUseCase({
			identityProvider: provider,
			userRepository,
		}),
		registerUser: new RegisterUserUseCase({ identityProvider: provider }),
		refreshSession: new RefreshSessionUseCase({ identityProvider: provider }),
		startSession: new StartSessionUseCase({
			sessionRepository,
			clock,
		}),
		resumeSession: new ResumeSessionUseCase({
			sessionRepository,
			idleTimeoutMs: IDLE_TIMEOUT_MS,
			clock,
		}),
		endSession: new EndSessionUseCase({ sessionRepository, clock }),
		requireAuth: passthroughAuth,
		requireUser: passthroughAuth,
		requireCompanyContext: passthroughAuth,
		// This slice never reaches these; the explicit `{} as never` records
		// that the wiring is intentionally inert rather than forgotten.
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

	return { app, sessionRepository, provider };
}

/** Reads the id out of the `session_id=...; Path=/auth; ...` header. */
function sessionIdFromCookieHeader(header: string | undefined): string {
	const match = header?.match(new RegExp(`^${SESSION_COOKIE_NAME}=([^;]+)`));
	if (match === null || match === undefined) {
		throw new Error(`No ${SESSION_COOKIE_NAME} cookie in: ${String(header)}`);
	}
	return match[1];
}

afterEach(() => {
	jest.restoreAllMocks();
});

describe("session lifetime", () => {
	it("login creates the session row the pair is bound to", async () => {
		const { app, sessionRepository } = createTestApp();

		const response = await request(app)
			.post("/auth/login")
			.send({ email: "session@example.com", password: "SUPERSECRET-PASSWORD" });

		expect(response.status).toBe(200);
		const cookies = responseCookies(response.headers["set-cookie"]);
		expect(cookies).toHaveLength(2);

		const sessionId = sessionIdFromCookieHeader(cookies?.[1]);
		const session = await sessionRepository.findById(sessionId);

		expect(session).not.toBeNull();
		// The row points at the user the login just upserted, not at the email
		// the caller typed: it is the id the API authorizes with.
		expect(session?.userId).not.toBe(USER_ID);
		expect(session?.createdAt).toEqual(NOW);
		expect(session?.lastActivityAt).toEqual(NOW);
	});

	it("refresh inside the window succeeds and moves the activity forward", async () => {
		let now = NOW;
		const { app, sessionRepository } = createTestApp({
			now: () => now,
			sessions: [liveSession()],
		});

		now = new Date(NOW.getTime() + IDLE_TIMEOUT_MS - 1);
		const response = await request(app)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			accessToken: ACCESS_TOKEN,
			expiresIn: EXPIRES_IN,
		});
		expect(
			(await sessionRepository.findById(SESSION_ID))?.lastActivityAt,
		).toEqual(now);
	});

	it("refresh exactly at the window answers the uniform 401, clears both cookies and never calls the provider", async () => {
		const { app, provider } = createTestApp({
			now: () => new Date(NOW.getTime() + IDLE_TIMEOUT_MS),
			sessions: [liveSession()],
		});

		const response = await request(app)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			error: { message: REFRESH_TOKEN_REJECTED_MESSAGE },
		});

		const cookies = responseCookies(response.headers["set-cookie"]);
		expect(cookies).toHaveLength(2);
		expect(cookies?.[0]).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=;`);
		expect(cookies?.[1]).toContain(`${SESSION_COOKIE_NAME}=;`);

		// The order matters: a rotating refresh token must never be spent on a
		// session that is already dead.
		expect(provider.refreshCalls).toEqual([]);
	});

	it("refresh of a revoked session answers the uniform 401 without calling the provider", async () => {
		const { app, provider } = createTestApp({
			sessions: [liveSession().revoke(NOW)],
		});

		const response = await request(app)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			error: { message: REFRESH_TOKEN_REJECTED_MESSAGE },
		});
		expect(provider.refreshCalls).toEqual([]);
	});

	it("rejects a refresh token without its session cookie, the shape a pre-change browser sends", async () => {
		const { app, provider } = createTestApp();

		const response = await request(app)
			.post("/auth/refresh")
			.set("Cookie", `${REFRESH_TOKEN_COOKIE_NAME}=${REFRESH_TOKEN}`);

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			error: { message: REFRESH_TOKEN_REJECTED_MESSAGE },
		});
		// Nothing is cleared: there is no session to clear, and the browser will
		// replace both cookies on the next sign-in.
		expect(response.headers["set-cookie"]).toBeUndefined();
		expect(provider.refreshCalls).toEqual([]);
	});

	it("rejects a session cookie without its refresh token", async () => {
		const { app, provider } = createTestApp();

		const response = await request(app)
			.post("/auth/refresh")
			.set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_ID}`);

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			error: { message: REFRESH_TOKEN_REJECTED_MESSAGE },
		});
		expect(provider.refreshCalls).toEqual([]);
	});

	it("logout revokes the row, so replaying the same cookies answers 401 and must sign in again", async () => {
		const { app, sessionRepository, provider } = createTestApp();

		const logout = await request(app)
			.post("/auth/logout")
			.set("Cookie", sessionCookies());

		expect(logout.status).toBe(204);
		expect((await sessionRepository.findById(SESSION_ID))?.revokedAt).toEqual(
			NOW,
		);

		const replay = await request(app)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());

		expect(replay.status).toBe(401);
		expect(replay.body).toEqual({
			error: { message: REFRESH_TOKEN_REJECTED_MESSAGE },
		});
		expect(provider.refreshCalls).toEqual([]);
	});

	it("asks the provider when the pair matches and relays its rejection as the same 401", async () => {
		const { app, provider } = createTestApp();
		provider.refreshResult = new RefreshTokenRejectedError();

		const response = await request(app)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());

		expect(response.status).toBe(401);
		expect(provider.refreshCalls).toEqual([REFRESH_TOKEN]);
	});

	it("rejects a stolen refresh token paired with another live session, without calling the provider", async () => {
		// The attack the digest binding closes: the session is live and valid,
		// but it was not issued for this token, so the pair is not a pair.
		const { app, provider, sessionRepository } = createTestApp();

		const response = await request(app)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies("stolen-refresh-token"));

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			error: { message: REFRESH_TOKEN_REJECTED_MESSAGE },
		});
		expect(provider.refreshCalls).toEqual([]);
		expect(
			(await sessionRepository.findById(SESSION_ID))?.lastActivityAt,
		).toEqual(NOW);
	});

	it("does not count a rejected exchange as activity", async () => {
		// Activity is a completed refresh: if a failing provider moved the clock,
		// a broken or revoked token retried forever would never idle out.
		const later = new Date(NOW.getTime() + IDLE_TIMEOUT_MS - 1);
		const { app, provider, sessionRepository } = createTestApp({
			now: () => later,
		});
		provider.refreshResult = new RefreshTokenRejectedError();

		const response = await request(app)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());

		expect(response.status).toBe(401);
		expect(
			(await sessionRepository.findById(SESSION_ID))?.lastActivityAt,
		).toEqual(NOW);
	});

	it("re-binds the session to the rotated token, so the previous one stops working", async () => {
		const { app } = createTestApp();

		const rotated = await request(app)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());
		expect(rotated.status).toBe(200);

		// The row now expects the token the provider just returned.
		const withOldToken = await request(app)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies());
		expect(withOldToken.status).toBe(401);

		const withNewToken = await request(app)
			.post("/auth/refresh")
			.set("Cookie", sessionCookies(NEW_REFRESH_TOKEN));
		expect(withNewToken.status).toBe(200);
	});
});
