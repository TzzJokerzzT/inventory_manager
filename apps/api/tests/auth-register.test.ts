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
import { SignUpRejectedError } from "../src/domain/errors/sign-up-rejected-error.js";
import type {
	UserIdentity,
	UserRepository,
} from "../src/domain/repositories/user-repository.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { buildApp } from "../src/interfaces/http/app.js";
import {
	type AuthCookieOptions,
	REFRESH_TOKEN_MAX_AGE_MS,
} from "../src/interfaces/http/controllers/auth-controller.js";
import { AUTH_REGISTER_RATE_LIMIT } from "../src/interfaces/http/middlewares/rate-limit.js";

const EMAIL = "someone@example.com";
const PASSWORD = "SUPERSECRET-PASSWORD-123";
const WEAK_PASSWORD = "short";

/**
 * The exact uniform body every successful and rejected sign up must answer
 * with. The test compares the two responses by equality, not by status, so a
 * drift between the branches cannot pass.
 */
const UNIFORM_REGISTER_BODY = {
	message: "If the address is new, we sent a verification email.",
};

class FakeIdentityProvider implements IdentityProvider {
	signUpError: Error | undefined;

	async exchangePasswordCredentials(
		_credentials: IdentityProviderCredentials,
	): Promise<IdentityTokens> {
		// Not exercised by the register tests: the login path never runs here.
		throw new Error("login not used in register tests");
	}

	async signUp(_credentials: IdentityProviderCredentials): Promise<void> {
		if (this.signUpError !== undefined) {
			throw this.signUpError;
		}
	}

	async refreshTokens(_refreshToken: string): Promise<IdentityTokens> {
		throw new Error("refresh not used in register tests");
	}

	async getIdentity(_accessToken: string): Promise<Identity> {
		throw new Error("identity not used in register tests");
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

function createTestApp(provider: IdentityProvider) {
	const companyRepository = new InMemoryCompanyRepository();
	const userRepository = new FakeUserRepository();

	return buildApp({
		createCompany: new CreateCompanyUseCase({ companyRepository }),
		listCompanies: new ListCompaniesUseCase({ companyRepository }),
		loginWithCredentials: new LoginWithCredentialsUseCase({
			identityProvider: provider,
			userRepository,
		}),
		registerUser: new RegisterUserUseCase({ identityProvider: provider }),
		refreshSession: new RefreshSessionUseCase({ identityProvider: provider }),
		requireAuth: passthroughAuth,
		requireUser: passthroughAuth,
		authCookieOptions: defaultCookieOptions,
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

describe("POST /auth/register", () => {
	it("returns 201 with the uniform body on success", async () => {
		const response = await request(createTestApp(new FakeIdentityProvider()))
			.post("/auth/register")
			.send({ email: EMAIL, password: PASSWORD });

		expect(response.status).toBe(201);
		expect(response.body).toEqual(UNIFORM_REGISTER_BODY);
	});

	it("answers a rejected sign up with the same body as a success (equality, not status)", async () => {
		const rejectedProvider = new FakeIdentityProvider();
		rejectedProvider.signUpError = new SignUpRejectedError();

		const success = await request(createTestApp(new FakeIdentityProvider()))
			.post("/auth/register")
			.send({ email: EMAIL, password: PASSWORD });

		const rejected = await request(createTestApp(rejectedProvider))
			.post("/auth/register")
			.send({ email: EMAIL, password: PASSWORD });

		expect(success.status).toBe(201);
		expect(rejected.status).toBe(success.status);
		expect(rejected.body).toEqual(success.body);
	});

	it("returns 400 for a malformed payload", async () => {
		const app = createTestApp(new FakeIdentityProvider());

		const badEmail = await request(app)
			.post("/auth/register")
			.send({ email: "not-an-email", password: PASSWORD });
		expect(badEmail.status).toBe(400);

		const missingPassword = await request(app)
			.post("/auth/register")
			.send({ email: EMAIL });
		expect(missingPassword.status).toBe(400);
	});

	it("returns 400 with a clear message for a weak password", async () => {
		const response = await request(createTestApp(new FakeIdentityProvider()))
			.post("/auth/register")
			.send({ email: EMAIL, password: WEAK_PASSWORD });

		expect(response.status).toBe(400);
		expect(response.body).toEqual({
			error: {
				message: "Invalid request body",
				issues: ["password must be at least 8 characters"],
			},
		});
	});

	it("returns 503 for an unavailable provider, distinct from a rejection", async () => {
		const provider = new FakeIdentityProvider();
		provider.signUpError = new IdentityProviderUnavailableError();

		const response = await request(createTestApp(provider))
			.post("/auth/register")
			.send({ email: EMAIL, password: PASSWORD });

		expect(response.status).toBe(503);
		expect(response.body).toEqual({
			error: { message: "Identity provider unavailable" },
		});
	});

	it("returns 429 once the configured register attempts are exceeded", async () => {
		const app = createTestApp(new FakeIdentityProvider());

		for (let attempt = 0; attempt < AUTH_REGISTER_RATE_LIMIT; attempt++) {
			const response = await request(app)
				.post("/auth/register")
				.send({ email: EMAIL, password: PASSWORD });
			expect(response.status).toBe(201);
		}

		const exceeded = await request(app)
			.post("/auth/register")
			.send({ email: EMAIL, password: PASSWORD });

		expect(exceeded.status).toBe(429);
	});

	it("never logs the password on a successful or rejected sign up", async () => {
		const spies = captureConsole();

		const success = await request(createTestApp(new FakeIdentityProvider()))
			.post("/auth/register")
			.send({ email: EMAIL, password: PASSWORD });
		expect(success.status).toBe(201);

		const rejectedProvider = new FakeIdentityProvider();
		rejectedProvider.signUpError = new SignUpRejectedError();
		const rejected = await request(createTestApp(rejectedProvider))
			.post("/auth/register")
			.send({ email: EMAIL, password: PASSWORD });
		expect(rejected.status).toBe(201);

		expect(spies.output()).not.toContain(PASSWORD);
		spies.restore();
	});
});
