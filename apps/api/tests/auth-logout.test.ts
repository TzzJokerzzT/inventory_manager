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

const REFRESH_TOKEN = "refresh-token-value";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";

class FakeIdentityProvider implements IdentityProvider {
	async exchangePasswordCredentials(
		_credentials: IdentityProviderCredentials,
	): Promise<IdentityTokens> {
		throw new Error("login not used in logout tests");
	}

	async signUp(_credentials: IdentityProviderCredentials): Promise<void> {
		// Not exercised by the logout tests.
	}

	async getIdentity(_accessToken: string): Promise<Identity> {
		throw new Error("identity not used in logout tests");
	}

	async refreshTokens(_refreshToken: string): Promise<IdentityTokens> {
		throw new Error("refresh not used in logout tests");
	}
}

/**
 * Rejects every request it guards. `/auth/logout` must still pass because it
 * is deliberately NOT behind `requireAuth` — an expired access token cannot
 * block signing out.
 */
const rejectingAuth: RequestHandler = (_request, response) => {
	response.status(401).json({ error: { message: "unauthorized" } });
};

const passthroughUser: RequestHandler = (_request, _response, next) => {
	next();
};

const defaultCookieOptions: AuthCookieOptions = {
	httpOnly: true,
	secure: false,
	sameSite: "lax",
	path: "/auth",
	maxAge: REFRESH_TOKEN_MAX_AGE_MS,
};

function createTestApp() {
	const companyRepository = new InMemoryCompanyRepository();
	const userRepository = createFakeUserRepository();
	const provider = new FakeIdentityProvider();
	const sessionRepository = new InMemorySessionRepository([
		Session.create({
			id: SESSION_ID,
			userId: "11111111-1111-4111-8111-111111111111",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			refreshTokenHash: hashRefreshToken(REFRESH_TOKEN),
		}),
	]);

	const app = buildApp({
		createCompany: new CreateCompanyUseCase({ companyRepository }),
		listCompanies: new ListCompaniesUseCase({ companyRepository }),
		loginWithCredentials: new LoginWithCredentialsUseCase({
			identityProvider: provider,
			userRepository,
		}),
		registerUser: new RegisterUserUseCase({ identityProvider: provider }),
		refreshSession: new RefreshSessionUseCase({ identityProvider: provider }),
		startSession: new StartSessionUseCase({ sessionRepository }),
		resumeSession: new ResumeSessionUseCase({
			sessionRepository,
			idleTimeoutMs: REFRESH_TOKEN_MAX_AGE_MS,
		}),
		endSession: new EndSessionUseCase({ sessionRepository }),
		requireAuth: rejectingAuth,
		requireUser: passthroughUser,
		requireCompanyContext: passthroughUser,
		// The logout slice never reaches these; the explicit `{} as never`
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
		lots: {} as never,
		authCookieOptions: defaultCookieOptions,
		corsOrigin: "http://localhost:3000",
	});

	return { app, sessionRepository };
}

describe("POST /auth/logout", () => {
	it("clears both session cookies with the same flags and path and returns 204", async () => {
		const { app } = createTestApp();

		const response = await request(app)
			.post("/auth/logout")
			.set(
				"Cookie",
				`${REFRESH_TOKEN_COOKIE_NAME}=${REFRESH_TOKEN}; ${SESSION_COOKIE_NAME}=${SESSION_ID}`,
			);

		expect(response.status).toBe(204);

		const cookies = responseCookies(response.headers["set-cookie"]);
		expect(cookies).toBeDefined();
		expect(cookies).toHaveLength(2);

		const refreshCookie = cookies?.[0];
		expect(refreshCookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=;`);
		expect(refreshCookie).toContain("Path=/auth");
		expect(refreshCookie).toContain("HttpOnly");
		expect(refreshCookie).toContain("SameSite=Lax");

		const sessionCookie = cookies?.[1];
		expect(sessionCookie).toContain(`${SESSION_COOKIE_NAME}=;`);
		expect(sessionCookie).toContain("Path=/auth");
		expect(sessionCookie).toContain("HttpOnly");
		expect(sessionCookie).toContain("SameSite=Lax");
	});

	it("revokes the session row so the credential stops working, not just the cookie", async () => {
		const { app, sessionRepository } = createTestApp();

		const response = await request(app)
			.post("/auth/logout")
			.set(
				"Cookie",
				`${REFRESH_TOKEN_COOKIE_NAME}=${REFRESH_TOKEN}; ${SESSION_COOKIE_NAME}=${SESSION_ID}`,
			);

		expect(response.status).toBe(204);
		expect(
			(await sessionRepository.findById(SESSION_ID))?.revokedAt,
		).not.toBeNull();
	});

	it("returns 204 even when there was no cookie (idempotent)", async () => {
		const { app } = createTestApp();
		const response = await request(app).post("/auth/logout");

		expect(response.status).toBe(204);
	});

	it("is not behind requireAuth, which still guards the company routes", async () => {
		// The same app rejects an authenticated-only route, proving the
		// rejecting guard is active while /auth/logout above passed without an
		// Authorization header.
		const { app } = createTestApp();
		const response = await request(app)
			.post("/companies")
			.send({ name: "Acme" });

		expect(response.status).toBe(401);
	});
});
