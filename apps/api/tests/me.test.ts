import request from "supertest";
import { GetCurrentUserUseCase } from "../src/application/use-cases/get-current-user.js";
import { UpdateUserFullNameUseCase } from "../src/application/use-cases/update-user-full-name.js";
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

describe("me endpoint", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	function createTestApp(extraUsers: User[] = []) {
		const companyRepository = new InMemoryCompanyRepository();
		const membershipRepository = new InMemoryMembershipRepository();

		const user = User.create({
			auth0Sub: USER_SUB,
			email: "me@example.com",
			createdAt: USER_CREATED_AT,
		});
		const userRepository = createFakeUserRepository([user, ...extraUsers]);
		const getCurrentUser = new GetCurrentUserUseCase({
			companyRepository,
			membershipRepository,
		});
		const updateUserFullName = new UpdateUserFullNameUseCase({
			userRepository,
		});

		const app = buildApp({
			createCompany: {} as never,
			listCompanies: {} as never,
			getCurrentUser,
			updateUserFullName,
			refreshSession: {} as never,
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
			requireUser: createRequireUser({ userRepository }),
			requireCompanyContext: (_request, _response, next) => next(),
			corsOrigin: TEST_WEB_ORIGIN,
		});

		return {
			app,
			user,
			userRepository,
			companyRepository,
			membershipRepository,
		};
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
			fullName: null,
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
			fullName: null,
			createdAt: USER_CREATED_AT.toISOString(),
			memberships: [],
		});
	});

	describe("PATCH /me", () => {
		it("sets the name and answers the NEW name, not the stale resolved user", async () => {
			const { app, user, userRepository } = createTestApp();

			const response = await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				.send({ fullName: "Alexis Buelvas" });

			expect(response.status).toBe(200);
			// The regression this guards: `requireUser` resolved `request.user`
			// before the write, so a controller that rebuilt the view from it
			// would answer 200 with the previous `null`.
			expect(response.body.fullName).toBe("Alexis Buelvas");
			const stored = await userRepository.findByAuth0Sub(user.auth0Sub);
			expect(stored?.fullName).toBe("Alexis Buelvas");
		});

		it("trims a padded name", async () => {
			const { app, user } = createTestApp();

			const response = await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				.send({ fullName: "  Alexis Buelvas  " });

			expect(response.status).toBe(200);
			expect(response.body.fullName).toBe("Alexis Buelvas");
		});

		it("clears the name with null", async () => {
			const { app, user } = createTestApp();
			await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				.send({ fullName: "Alexis Buelvas" });

			const response = await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				.send({ fullName: null });

			expect(response.status).toBe(200);
			expect(response.body.fullName).toBeNull();
		});

		it("clears the name with an empty string", async () => {
			const { app, user } = createTestApp();
			await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				.send({ fullName: "Alexis Buelvas" });

			const response = await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				.send({ fullName: "" });

			expect(response.status).toBe(200);
			expect(response.body.fullName).toBeNull();
		});

		it("clears the name with a whitespace-only string", async () => {
			const { app, user } = createTestApp();
			await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				.send({ fullName: "Alexis Buelvas" });

			const response = await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				.send({ fullName: "   " });

			expect(response.status).toBe(200);
			expect(response.body.fullName).toBeNull();
		});

		it("answers 400 when fullName is missing", async () => {
			const { app, user } = createTestApp();

			const response = await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				.send({});

			expect(response.status).toBe(400);
			expect(response.body.error.message).toBe("Invalid request body");
			expect(response.body.error.issues).toEqual(expect.any(Array));
		});

		it.each([[42], [["a"]], [{ nested: true }], [true]])(
			"answers 400 when fullName is a non-string non-null value (%p)",
			async (fullName) => {
				const { app, user } = createTestApp();

				const response = await request(app)
					.patch("/me")
					.set("authorization", authorization(user))
					.send({ fullName });

				expect(response.status).toBe(400);
				expect(response.body.error.message).toBe("Invalid request body");
			},
		);

		it("answers 400 when fullName exceeds 120 characters after trim", async () => {
			const { app, user } = createTestApp();

			const response = await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				.send({ fullName: "a".repeat(121) });

			expect(response.status).toBe(400);
			expect(response.body.error.message).toBe("Invalid request body");
		});

		it("accepts a name of exactly 120 characters after trimming", async () => {
			const { app, user, userRepository } = createTestApp();
			const name = "a".repeat(120);

			const response = await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				// Padded on purpose: the raw length is 124, so this only passes
				// because the server trims BEFORE applying the 120-character cap.
				.send({ fullName: `  ${name}  ` });

			expect(response.status).toBe(200);
			expect(response.body.fullName).toBe(name);
			const stored = await userRepository.findByAuth0Sub(user.auth0Sub);
			expect(stored?.fullName).toBe(name);
		});

		it("ignores extra body keys and never writes another user's row", async () => {
			const other = User.create({
				auth0Sub: "auth0|me-other-user",
				email: "other@example.com",
				fullName: "Other User",
				createdAt: USER_CREATED_AT,
			});
			const { app, user, userRepository } = createTestApp([other]);

			const response = await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				// `userId` and `email` are not part of `UpdateMeRequest`; the subject
				// must come from `request.user`, never from the body.
				.send({
					fullName: "Alexis Buelvas",
					userId: other.id,
					email: other.email,
				});

			expect(response.status).toBe(200);
			// The answer still reflects the caller: same identity as the token.
			expect(response.body.id).toBe(user.id);
			expect(response.body.email).toBe("me@example.com");
			expect(response.body.fullName).toBe("Alexis Buelvas");

			const otherRow = await userRepository.findByAuth0Sub(other.auth0Sub);
			expect(otherRow?.fullName).toBe("Other User");
			expect(otherRow?.email).toBe("other@example.com");

			const callerRow = await userRepository.findByAuth0Sub(user.auth0Sub);
			expect(callerRow?.fullName).toBe("Alexis Buelvas");
			expect(callerRow?.email).toBe("me@example.com");
		});

		it("answers 401 without a token", async () => {
			const { app } = createTestApp();

			const response = await request(app)
				.patch("/me")
				.send({ fullName: "Alexis Buelvas" });

			expect(response.status).toBe(401);
		});

		it("answers 403 user_not_provisioned when the token resolves to no users row", async () => {
			const { app } = createTestApp();
			const unprovisionedToken = issuer.signToken({ sub: "auth0|unknown" });

			const response = await request(app)
				.patch("/me")
				.set("authorization", `Bearer ${unprovisionedToken}`)
				.send({ fullName: "Alexis Buelvas" });

			expect(response.status).toBe(403);
			expect(response.body).toEqual({
				error: {
					message: "User not provisioned",
					code: "user_not_provisioned",
				},
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
				.patch("/me")
				.set("authorization", authorization(user))
				.send({ fullName: "Alexis Buelvas" });

			expect(response.status).toBe(200);
			// Assert on the raw serialized body for the same reason as `GET /me`:
			// a nested `toJSON` could leak the subject without the top-level view
			// showing it.
			expect(response.text).not.toContain("auth0Sub");
			expect(response.body).not.toHaveProperty("auth0Sub");
			expect(response.body.memberships[0].company).not.toHaveProperty(
				"auth0Sub",
			);
		});

		it("answers the same shape as GET /me, identity plus memberships", async () => {
			const { app, user, companyRepository, membershipRepository } =
				createTestApp();
			await seedCompany(
				companyRepository,
				membershipRepository,
				user,
				"company-a",
				"Acme",
			);

			const patchResponse = await request(app)
				.patch("/me")
				.set("authorization", authorization(user))
				.send({ fullName: "Alexis Buelvas" });
			const getResponse = await request(app)
				.get("/me")
				.set("authorization", authorization(user));

			expect(patchResponse.status).toBe(200);
			expect(patchResponse.body).toEqual(getResponse.body);
		});
	});
});
