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

const REFRESH_TOKEN = "refresh-token-value";

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

class FakeUserRepository implements UserRepository {
	async upsertFromIdentity(identity: UserIdentity): Promise<User> {
		return User.create(identity);
	}

	async findByAuth0Sub(_auth0Sub: string): Promise<User | null> {
		return null;
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
	const userRepository = new FakeUserRepository();
	const provider = new FakeIdentityProvider();

	return buildApp({
		createCompany: new CreateCompanyUseCase({ companyRepository }),
		listCompanies: new ListCompaniesUseCase({ companyRepository }),
		loginWithCredentials: new LoginWithCredentialsUseCase({
			identityProvider: provider,
			userRepository,
		}),
		registerUser: new RegisterUserUseCase({ identityProvider: provider }),
		refreshSession: new RefreshSessionUseCase({ identityProvider: provider }),
		requireAuth: rejectingAuth,
		requireUser: passthroughUser,
		requireCompanyContext: passthroughUser,
		authCookieOptions: defaultCookieOptions,
		corsOrigin: "http://localhost:3000",
	});
}

describe("POST /auth/logout", () => {
	it("clears the refresh cookie with the same flags and path and returns 204", async () => {
		const response = await request(createTestApp())
			.post("/auth/logout")
			.set("Cookie", `${REFRESH_TOKEN_COOKIE_NAME}=${REFRESH_TOKEN}`);

		expect(response.status).toBe(204);

		const cookies = response.headers["set-cookie"] as string[] | undefined;
		expect(cookies).toBeDefined();
		expect(cookies[0]).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=;`);
		expect(cookies[0]).toContain("Path=/auth");
		expect(cookies[0]).toContain("HttpOnly");
		expect(cookies[0]).toContain("SameSite=Lax");
	});

	it("returns 204 even when there was no cookie (idempotent)", async () => {
		const response = await request(createTestApp()).post("/auth/logout");

		expect(response.status).toBe(204);
	});

	it("is not behind requireAuth, which still guards the company routes", async () => {
		// The same app rejects an authenticated-only route, proving the
		// rejecting guard is active while /auth/logout above passed without an
		// Authorization header.
		const response = await request(createTestApp())
			.post("/companies")
			.send({ name: "Acme" });

		expect(response.status).toBe(401);
	});
});
