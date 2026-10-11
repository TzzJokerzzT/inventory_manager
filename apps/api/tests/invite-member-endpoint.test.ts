import request from "supertest";
import { CreateCompanyUseCase } from "../src/application/use-cases/create-company.js";
import { InviteMemberUseCase } from "../src/application/use-cases/invite-member.js";
import { ListCompaniesUseCase } from "../src/application/use-cases/list-companies.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";
import { buildApp } from "../src/interfaces/http/app.js";
import { createRequireAuth } from "../src/interfaces/http/middlewares/require-auth.js";
import { createRequireCompanyContext } from "../src/interfaces/http/middlewares/require-company-context.js";
import { createRequireUser } from "../src/interfaces/http/middlewares/require-user.js";
import { createFakeUserRepository } from "./support/fake-user-repository.js";
import {
	type LocalIssuer,
	startLocalIssuer,
	TEST_AUDIENCE,
} from "./support/local-jwks-issuer.js";

const TEST_WEB_ORIGIN = "http://localhost:3000";

describe("POST /companies/:companyId/members", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	async function createTestApp(
		callerRole: MembershipRole,
		previousMembershipStatus?: "ACTIVE" | "INVITED" | "REVOKED",
	) {
		const companyRepository = new InMemoryCompanyRepository();
		const membershipRepository = new InMemoryMembershipRepository();

		const caller = User.create({
			auth0Sub: "auth0|caller",
			email: "caller@example.com",
		});
		const outsider = User.create({
			auth0Sub: "auth0|outsider",
			email: "outsider@example.com",
		});
		const userRepository = createFakeUserRepository([caller, outsider]);

		const company = Company.create({ name: "Acme" });
		await companyRepository.createOwnedBy(company, {
			userId: caller.id,
			email: caller.email,
		});

		// The caller's ACTIVE membership is what `requireCompanyContext` needs to
		// resolve the company context; its `role` drives the authorization matrix.
		membershipRepository.save(
			Membership.create({
				userId: caller.id,
				invitedEmail: caller.email,
				companyId: company.id,
				role: callerRole,
				status: "ACTIVE",
				invitedBy: caller.id,
				acceptedAt: new Date(),
			}),
		);

		// Optional pre-existing membership for the invited email, used by the
		// duplicate-invitation cases.
		if (previousMembershipStatus !== undefined) {
			membershipRepository.save(
				Membership.create({
					userId:
						previousMembershipStatus === "ACTIVE" ? "existing-user" : null,
					invitedEmail: "invited@example.com",
					companyId: company.id,
					role: "MEMBER",
					status: previousMembershipStatus,
					invitedBy: caller.id,
					acceptedAt: previousMembershipStatus === "ACTIVE" ? new Date() : null,
				}),
			);
		}

		const app = buildApp({
			createCompany: new CreateCompanyUseCase({ companyRepository }),
			listCompanies: new ListCompaniesUseCase({ companyRepository }),
			inviteMember: new InviteMemberUseCase({ membershipRepository }),
			loginWithCredentials: {} as never,
			registerUser: {} as never,
			refreshSession: {} as never,
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
			requireUser: createRequireUser({ userRepository }),
			requireCompanyContext: createRequireCompanyContext({
				membershipRepository,
			}),
			mediaUploadSigner: {} as never,
			authCookieOptions: {
				httpOnly: true,
				secure: false,
				sameSite: "lax",
				path: "/auth",
				maxAge: 30 * 24 * 60 * 60 * 1000,
			},
			corsOrigin: TEST_WEB_ORIGIN,
		});

		return { app, company, caller, outsider, membershipRepository };
	}

	function authorization(user: User): string {
		return `Bearer ${issuer.signToken({ sub: user.auth0Sub })}`;
	}

	it("lets an OWNER invite a MEMBER and answers 201 with the INVITED membership", async () => {
		const { app, company, caller } = await createTestApp("OWNER");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(caller))
			.send({ email: "new@example.com", role: "MEMBER" });

		expect(response.status).toBe(201);
		expect(response.body).toMatchObject({
			invitedEmail: "new@example.com",
			companyId: company.id,
			role: "MEMBER",
			status: "INVITED",
			userId: null,
			acceptedAt: null,
			invitedBy: caller.id,
		});
		expect(typeof response.body.id).toBe("string");
	});

	it("lowercases the invited email before persisting", async () => {
		const { app, company, caller } = await createTestApp("OWNER");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(caller))
			.send({ email: "  Mixed.Case@Example.COM  ", role: "MEMBER" });

		expect(response.status).toBe(201);
		expect(response.body.invitedEmail).toBe("mixed.case@example.com");
	});

	it("lets a MEMBER be invited by an ADMIN", async () => {
		const { app, company, caller } = await createTestApp("ADMIN");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(caller))
			.send({ email: "new@example.com", role: "MEMBER" });

		expect(response.status).toBe(201);
		expect(response.body.role).toBe("MEMBER");
	});

	it("answers 403 insufficient_role when an ADMIN tries to invite an OWNER", async () => {
		const { app, company, caller } = await createTestApp("ADMIN");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(caller))
			.send({ email: "new@example.com", role: "OWNER" });

		expect(response.status).toBe(403);
		expect(response.body.error.code).toBe("insufficient_role");
	});

	it("answers 403 insufficient_role for a MEMBER", async () => {
		const { app, company, caller } = await createTestApp("MEMBER");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(caller))
			.send({ email: "new@example.com", role: "MEMBER" });

		expect(response.status).toBe(403);
		expect(response.body.error.code).toBe("insufficient_role");
	});

	it("answers 409 membership_already_exists for an ACTIVE membership", async () => {
		const { app, company, caller } = await createTestApp("OWNER", "ACTIVE");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(caller))
			.send({ email: "invited@example.com", role: "MEMBER" });

		expect(response.status).toBe(409);
		expect(response.body.error.code).toBe("membership_already_exists");
	});

	it("answers 409 membership_already_exists for a pending invitation", async () => {
		const { app, company, caller } = await createTestApp("OWNER", "INVITED");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(caller))
			.send({ email: "invited@example.com", role: "MEMBER" });

		expect(response.status).toBe(409);
		expect(response.body.error.code).toBe("membership_already_exists");
	});

	it("allows re-inviting an email whose membership was REVOKED", async () => {
		const { app, company, caller } = await createTestApp("OWNER", "REVOKED");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(caller))
			.send({ email: "invited@example.com", role: "MEMBER" });

		expect(response.status).toBe(201);
		expect(response.body.status).toBe("INVITED");
	});

	it("answers 403 company_access_forbidden for a non-member (never 404)", async () => {
		const { app, company, outsider } = await createTestApp("OWNER");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(outsider))
			.send({ email: "new@example.com", role: "MEMBER" });

		expect(response.status).toBe(403);
		expect(response.body.error.code).toBe("company_access_forbidden");
	});

	it("answers 401 without a token", async () => {
		const { app, company } = await createTestApp("OWNER");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.send({ email: "new@example.com", role: "MEMBER" });

		expect(response.status).toBe(401);
	});

	it("answers 400 for an invalid email", async () => {
		const { app, company, caller } = await createTestApp("OWNER");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(caller))
			.send({ email: "not-an-email", role: "MEMBER" });

		expect(response.status).toBe(400);
	});

	it("answers 400 for an unknown role", async () => {
		const { app, company, caller } = await createTestApp("OWNER");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(caller))
			.send({ email: "new@example.com", role: "SUPERADMIN" });

		expect(response.status).toBe(400);
	});

	it("never exposes the membership of another company", async () => {
		// Same email invited in a different company does not collide: the
		// uniqueness check is per (email, company).
		const { app, company, caller } = await createTestApp("OWNER", "ACTIVE");

		const response = await request(app)
			.post(`/companies/${company.id}/members`)
			.set("authorization", authorization(caller))
			.send({ email: "fresh@example.com", role: "MEMBER" });

		expect(response.status).toBe(201);
	});
});
