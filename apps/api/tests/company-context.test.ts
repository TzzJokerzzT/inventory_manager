import request from "supertest";
import { CreateCompanyUseCase } from "../src/application/use-cases/create-company.js";
import { ListCompaniesUseCase } from "../src/application/use-cases/list-companies.js";
import { Company } from "../src/domain/entities/company.js";
import { Membership } from "../src/domain/entities/membership.js";
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

describe("GET /companies/:companyId/context", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	async function createTestApp() {
		const companyRepository = new InMemoryCompanyRepository();
		const membershipRepository = new InMemoryMembershipRepository();

		const owner = User.create({
			auth0Sub: "auth0|owner",
			email: "owner@example.com",
		});
		const outsider = User.create({
			auth0Sub: "auth0|outsider",
			email: "outsider@example.com",
		});
		const userRepository = createFakeUserRepository([owner, outsider]);

		const company = Company.create({ name: "Acme" });
		await companyRepository.createOwnedBy(company, {
			userId: owner.id,
			email: owner.email,
		});

		// The middleware resolves membership through the membership repository
		// while the controller lists the company through the company
		// repository; seed the owner's ACTIVE membership in both so the two
		// adapters stay consistent behind the port.
		membershipRepository.save(
			Membership.create({
				userId: owner.id,
				invitedEmail: owner.email,
				companyId: company.id,
				role: "OWNER",
				status: "ACTIVE",
				invitedBy: owner.id,
				acceptedAt: new Date(),
			}),
		);

		const app = buildApp({
			createCompany: new CreateCompanyUseCase({ companyRepository }),
			listCompanies: new ListCompaniesUseCase({ companyRepository }),
			refreshSession: {} as never,
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
			requireUser: createRequireUser({ userRepository }),
			requireCompanyContext: createRequireCompanyContext({
				membershipRepository,
			}),
			corsOrigin: TEST_WEB_ORIGIN,
		});

		return { app, company, owner, outsider, membershipRepository };
	}

	function authorization(user: User): string {
		return `Bearer ${issuer.signToken({ sub: user.auth0Sub })}`;
	}

	it("returns the company and role for a member", async () => {
		const { app, company, owner } = await createTestApp();

		const response = await request(app)
			.get(`/companies/${company.id}/context`)
			.set("authorization", authorization(owner));

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			company: { id: company.id, name: "Acme" },
			role: "OWNER",
		});
	});

	it("answers the same uniform 403 body for a non-member and a non-existent company", async () => {
		const { app, company, outsider } = await createTestApp();

		const nonMember = await request(app)
			.get(`/companies/${company.id}/context`)
			.set("authorization", authorization(outsider));
		const nonExistent = await request(app)
			.get("/companies/00000000-0000-4000-8000-000000000000/context")
			.set("authorization", authorization(outsider));

		expect(nonMember.status).toBe(403);
		expect(nonExistent.status).toBe(403);
		expect(nonMember.body).toEqual(nonExistent.body);
	});

	it("answers 403 for a REVOKED membership", async () => {
		const { app, company, outsider, membershipRepository } =
			await createTestApp();
		membershipRepository.save(
			Membership.create({
				userId: outsider.id,
				invitedEmail: outsider.email,
				companyId: company.id,
				role: "MEMBER",
				status: "REVOKED",
				invitedBy: "owner-1",
				acceptedAt: new Date(),
			}),
		);

		const response = await request(app)
			.get(`/companies/${company.id}/context`)
			.set("authorization", authorization(outsider));

		expect(response.status).toBe(403);
	});

	it("answers 403 for an INVITED membership", async () => {
		const { app, company, outsider, membershipRepository } =
			await createTestApp();
		membershipRepository.save(
			Membership.create({
				userId: outsider.id,
				invitedEmail: outsider.email,
				companyId: company.id,
				role: "MEMBER",
				status: "INVITED",
				invitedBy: "owner-1",
				acceptedAt: null,
			}),
		);

		const response = await request(app)
			.get(`/companies/${company.id}/context`)
			.set("authorization", authorization(outsider));

		expect(response.status).toBe(403);
	});

	it("still answers 401 for an unauthenticated request (requireAuth runs first)", async () => {
		const { app, company } = await createTestApp();

		const response = await request(app).get(`/companies/${company.id}/context`);

		expect(response.status).toBe(401);
	});

	it("answers 400 for an invalid company id format", async () => {
		const { app, owner } = await createTestApp();

		const response = await request(app)
			.get("/companies/not-a-uuid/context")
			.set("authorization", authorization(owner));

		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({
			error: { message: "Invalid company id" },
		});
	});

	it("fails closed with the uniform 403 when a membership exists but the company does not", async () => {
		const { app, owner, membershipRepository } = await createTestApp();
		const ghostCompanyId = "11111111-2222-4333-8444-555555555555";
		membershipRepository.save(
			Membership.create({
				userId: owner.id,
				invitedEmail: owner.email,
				companyId: ghostCompanyId,
				role: "OWNER",
				status: "ACTIVE",
				invitedBy: owner.id,
				acceptedAt: new Date(),
			}),
		);

		const response = await request(app)
			.get(`/companies/${ghostCompanyId}/context`)
			.set("authorization", authorization(owner));

		expect(response.status).toBe(403);
		expect(response.body).toMatchObject({
			error: { code: "company_access_forbidden" },
		});
	});
});
