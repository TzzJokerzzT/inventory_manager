import request from "supertest";
import { GetCurrentUserUseCase } from "../src/application/use-cases/get-current-user.js";
import { Company } from "../src/domain/entities/company.js";
import { Membership } from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";
import { buildApp } from "../src/interfaces/http/app.js";
import { createRequireAuth } from "../src/interfaces/http/middlewares/require-auth.js";
import { createRequireUser } from "../src/interfaces/http/middlewares/require-user.js";
import { createFakeUserRepository } from "./support/fake-user-repository.js";
import {
	type LocalIssuer,
	startLocalIssuer,
	TEST_AUDIENCE,
} from "./support/local-jwks-issuer.js";

const TEST_WEB_ORIGIN = "http://localhost:3000";
const USER_SUB = "auth0|me-user";
const USER_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

describe("GET /me", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	function createTestApp() {
		const companyRepository = new InMemoryCompanyRepository();
		const membershipRepository = new InMemoryMembershipRepository();

		const user = User.create({
			auth0Sub: USER_SUB,
			email: "me@example.com",
			createdAt: USER_CREATED_AT,
		});
		const userRepository = createFakeUserRepository([user]);
		const getCurrentUser = new GetCurrentUserUseCase({
			companyRepository,
			membershipRepository,
		});

		const app = buildApp({
			createCompany: {} as never,
			listCompanies: {} as never,
			getCurrentUser,
			refreshSession: {} as never,
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
			requireUser: createRequireUser({ userRepository }),
			requireCompanyContext: (_request, _response, next) => next(),
			corsOrigin: TEST_WEB_ORIGIN,
		});

		return { app, user, companyRepository, membershipRepository };
	}

	function authorization(user: User): string {
		return `Bearer ${issuer.signToken({ sub: user.auth0Sub })}`;
	}

	/**
	 * Seeds a company the user owns in both adapters. The company repository's
	 * `findAllForUser` reads its own bootstrap membership, while the use case's
	 * `findActiveByUser` reads the membership repository, so a consistent
	 * fixture writes to both behind the same port pair.
	 */
	async function seedCompany(
		companyRepository: InMemoryCompanyRepository,
		membershipRepository: InMemoryMembershipRepository,
		user: User,
		companyId: string,
		name: string,
		role: "OWNER" | "ADMIN" | "MEMBER" = "OWNER",
	): Promise<Company> {
		const company = await companyRepository.createOwnedBy(
			Company.create({
				id: companyId,
				name,
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			}),
			{ userId: user.id, email: user.email },
		);
		membershipRepository.save(
			Membership.create({
				userId: user.id,
				invitedEmail: user.email,
				companyId: company.id,
				role,
				status: "ACTIVE",
				invitedBy: user.id,
				acceptedAt: new Date("2026-01-01T00:00:00.000Z"),
			}),
		);
		return company;
	}

	it("returns the public identity and every membership with its serialized company", async () => {
		const { app, user, companyRepository, membershipRepository } =
			createTestApp();
		await seedCompany(
			companyRepository,
			membershipRepository,
			user,
			"company-a",
			"Acme",
			"OWNER",
		);
		await seedCompany(
			companyRepository,
			membershipRepository,
			user,
			"company-b",
			"Globex",
			"ADMIN",
		);

		const response = await request(app)
			.get("/me")
			.set("authorization", authorization(user));

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			id: user.id,
			email: "me@example.com",
			createdAt: USER_CREATED_AT.toISOString(),
			memberships: expect.any(Array),
		});
		expect(response.body.memberships).toHaveLength(2);

		const byCompanyId = new Map(
			response.body.memberships.map((membership: { companyId: string }) => [
				membership.companyId,
				membership,
			]),
		);
		expect(byCompanyId.get("company-a")).toEqual({
			companyId: "company-a",
			role: "OWNER",
			company: {
				id: "company-a",
				name: "Acme",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		});
		expect(byCompanyId.get("company-b")).toEqual({
			companyId: "company-b",
			role: "ADMIN",
			company: {
				id: "company-b",
				name: "Globex",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		});
	});

	it("answers 401 without a token", async () => {
		const { app } = createTestApp();

		const response = await request(app).get("/me");

		expect(response.status).toBe(401);
	});

	it("answers 403 user_not_provisioned when the token resolves to no users row", async () => {
		const { app, user } = createTestApp();
		const unprovisionedToken = issuer.signToken({ sub: "auth0|unknown" });

		const response = await request(app)
			.get("/me")
			.set("authorization", `Bearer ${unprovisionedToken}`);

		expect(user.auth0Sub).toBe(USER_SUB);
		expect(response.status).toBe(403);
		expect(response.body).toEqual({
			error: { message: "User not provisioned", code: "user_not_provisioned" },
		});
	});

	it("never serializes auth0Sub in the response body", async () => {
		const { app, user, companyRepository, membershipRepository } =
			createTestApp();
		await seedCompany(
			companyRepository,
			membershipRepository,
			user,
			"company-a",
			"Acme",
		);

		const response = await request(app)
			.get("/me")
			.set("authorization", authorization(user));

		expect(response.status).toBe(200);
		// Assert on the raw serialized body, not only on a typed field: a nested
		// `toJSON` could leak the subject without the top-level view showing it.
		expect(response.text).not.toContain("auth0Sub");
		expect(response.body).not.toHaveProperty("auth0Sub");
		expect(response.body.memberships[0].company).not.toHaveProperty("auth0Sub");
	});

	it("returns an empty memberships list for a user with no memberships", async () => {
		const { app, user } = createTestApp();

		const response = await request(app)
			.get("/me")
			.set("authorization", authorization(user));

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			id: user.id,
			email: "me@example.com",
			createdAt: USER_CREATED_AT.toISOString(),
			memberships: [],
		});
	});
});
