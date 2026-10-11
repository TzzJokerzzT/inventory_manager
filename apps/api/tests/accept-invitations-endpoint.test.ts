import request from "supertest";
import { AcceptInvitationsUseCase } from "../src/application/use-cases/accept-invitations.js";
import { CreateCompanyUseCase } from "../src/application/use-cases/create-company.js";
import { GetCurrentUserUseCase } from "../src/application/use-cases/get-current-user.js";
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
const INVITEE_SUB = "auth0|invitee";
const INVITEE_EMAIL = "invitee@example.com";

describe("POST /me/invitations/accept", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	async function createTestApp(
		options: {
			invitedEmail?: string;
			status?: "INVITED" | "REVOKED" | "ACTIVE";
		} = {},
	) {
		const companyRepository = new InMemoryCompanyRepository();
		const membershipRepository = new InMemoryMembershipRepository();

		const owner = User.create({
			auth0Sub: "auth0|owner",
			email: "owner@example.com",
		});
		const invitee = User.create({
			auth0Sub: INVITEE_SUB,
			email: INVITEE_EMAIL,
		});
		const userRepository = createFakeUserRepository([owner, invitee]);

		const company = Company.create({ name: "Acme" });
		await companyRepository.createOwnedBy(company, {
			userId: owner.id,
			email: owner.email,
		});

		// The owner's own ACTIVE membership, plus the pending invitation for the
		// invitee that the endpoint under test has to claim.
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
		membershipRepository.save(
			Membership.create({
				userId: null,
				invitedEmail: options.invitedEmail ?? INVITEE_EMAIL,
				companyId: company.id,
				role: "MEMBER",
				status: options.status ?? "INVITED",
				invitedBy: owner.id,
				acceptedAt: null,
			}),
		);

		const app = buildApp({
			acceptInvitations: new AcceptInvitationsUseCase({
				membershipRepository,
			}),
			createCompany: new CreateCompanyUseCase({ companyRepository }),
			getCurrentUser: new GetCurrentUserUseCase({
				companyRepository,
				membershipRepository,
			}),
			listCompanies: new ListCompaniesUseCase({ companyRepository }),
			updateUserFullName: {} as never,
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
			// A stub signer: the media-signature route is used here only as the
			// cheapest company-scoped endpoint, to prove that the company context
			// starts and stops resolving around the acceptance.
			mediaUploadSigner: {
				createUploadSignature: () => ({ signed: true }),
			} as never,
			authCookieOptions: {
				httpOnly: true,
				secure: false,
				sameSite: "lax",
				path: "/auth",
				maxAge: 30 * 24 * 60 * 60 * 1000,
			},
			corsOrigin: TEST_WEB_ORIGIN,
		});

		return { app, company, owner, invitee, membershipRepository };
	}

	function authorization(sub: string): string {
		return `Bearer ${issuer.signToken({ sub })}`;
	}

	it("accepts the pending invitation and answers 200 with the ACTIVE membership", async () => {
		const { app, company, invitee } = await createTestApp();

		const response = await request(app)
			.post("/me/invitations/accept")
			.set("authorization", authorization(invitee.auth0Sub))
			.send({});

		expect(response.status).toBe(200);
		expect(response.body).toHaveLength(1);
		expect(response.body[0]).toMatchObject({
			invitedEmail: INVITEE_EMAIL,
			companyId: company.id,
			role: "MEMBER",
			status: "ACTIVE",
			userId: invitee.id,
		});
		expect(response.body[0].acceptedAt).not.toBeNull();
	});

	it("grants company access after accepting (a company-scoped route stops being 403)", async () => {
		const { app, company, invitee } = await createTestApp();

		// Before accepting, the invitee has no ACTIVE membership, so
		// `requireCompanyContext` answers the uniform 403.
		const before = await request(app)
			.post(`/companies/${company.id}/media/signature`)
			.set("authorization", authorization(invitee.auth0Sub))
			.send({});
		expect(before.status).toBe(403);
		expect(before.body.error.code).toBe("company_access_forbidden");

		await request(app)
			.post("/me/invitations/accept")
			.set("authorization", authorization(invitee.auth0Sub))
			.send({});

		// After accepting, the same request resolves the company context.
		const after = await request(app)
			.post(`/companies/${company.id}/media/signature`)
			.set("authorization", authorization(invitee.auth0Sub))
			.send({});
		expect(after.status).toBe(200);
	});

	it("leaves the membership ACTIVE in the store, which is what GET /me joins", async () => {
		const { app, invitee, membershipRepository } = await createTestApp();

		await request(app)
			.post("/me/invitations/accept")
			.set("authorization", authorization(invitee.auth0Sub))
			.send({});

		// `GET /me` joins `findActiveByUser` with `findAllForUser`. Asserted at
		// the port instead of over HTTP because the in-memory company double
		// keeps a static single-member roster, while production's
		// `PrismaCompanyRepository.findAllForUser` reads the live membership
		// table: after the same accept, the real join returns the company.
		const active = await membershipRepository.findActiveByUser(invitee.id);

		expect(active).toHaveLength(1);
		expect(active[0]).toMatchObject({
			companyId: expect.any(String),
			role: "MEMBER",
			status: "ACTIVE",
		});
	});

	it("is idempotent: the second call answers 200 with an empty array", async () => {
		const { app, invitee } = await createTestApp();

		const first = await request(app)
			.post("/me/invitations/accept")
			.set("authorization", authorization(invitee.auth0Sub))
			.send({});
		const second = await request(app)
			.post("/me/invitations/accept")
			.set("authorization", authorization(invitee.auth0Sub))
			.send({});

		expect(first.status).toBe(200);
		expect(first.body).toHaveLength(1);
		expect(second.status).toBe(200);
		expect(second.body).toEqual([]);
	});

	it("does not accept an invitation addressed to another email", async () => {
		const { app, invitee, membershipRepository } = await createTestApp({
			invitedEmail: "someone-else@example.com",
		});

		const response = await request(app)
			.post("/me/invitations/accept")
			.set("authorization", authorization(invitee.auth0Sub))
			.send({});

		expect(response.status).toBe(200);
		expect(response.body).toEqual([]);

		// And the row is still pending for its real owner.
		const stillInvited = await membershipRepository.findInvitedByEmail(
			"someone-else@example.com",
		);
		expect(stillInvited).toHaveLength(1);
	});

	it("never revives a REVOKED membership", async () => {
		const { app, invitee } = await createTestApp({ status: "REVOKED" });

		const response = await request(app)
			.post("/me/invitations/accept")
			.set("authorization", authorization(invitee.auth0Sub))
			.send({});

		expect(response.status).toBe(200);
		expect(response.body).toEqual([]);
	});

	it("answers 401 without a token", async () => {
		const { app } = await createTestApp();

		const response = await request(app).post("/me/invitations/accept").send({});

		expect(response.status).toBe(401);
	});

	it("answers 403 user_not_provisioned when the token resolves to no users row", async () => {
		const { app } = await createTestApp();

		const response = await request(app)
			.post("/me/invitations/accept")
			.set("authorization", authorization("auth0|unknown"))
			.send({});

		expect(response.status).toBe(403);
		expect(response.body).toEqual({
			error: { message: "User not provisioned", code: "user_not_provisioned" },
		});
	});

	it("needs no company context: a user with no memberships at all can call it", async () => {
		// Regression guard for the route mount: putting this endpoint behind
		// `requireCompanyContext` would make it unreachable exactly for the user
		// who has nothing ACTIVE yet.
		const { app, owner } = await createTestApp({
			invitedEmail: "nobody@example.com",
		});

		const response = await request(app)
			.post("/me/invitations/accept")
			.set("authorization", authorization(owner.auth0Sub))
			.send({});

		expect(response.status).toBe(200);
	});
});
