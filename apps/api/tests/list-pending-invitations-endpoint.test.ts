import request from "supertest";
import { ListPendingInvitationsUseCase } from "../src/application/use-cases/list-pending-invitations.js";
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
const INVITEE_SUB = "auth0|invitee";
const INVITEE_EMAIL = "invitee@example.com";
const INVITED_AT = new Date("2026-01-02T03:04:05.000Z");

describe("GET /me/invitations", () => {
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
		const invitee = User.create({
			auth0Sub: INVITEE_SUB,
			email: INVITEE_EMAIL,
		});
		const userRepository = createFakeUserRepository([owner, invitee]);

		const app = buildApp({
			listPendingInvitations: new ListPendingInvitationsUseCase({
				companyRepository,
				membershipRepository,
				userRepository,
			}),
			createCompany: {} as never,
			changeMemberRole: {} as never,
			getCurrentUser: {} as never,
			inviteMember: {} as never,
			leaveCompany: {} as never,
			listCompanies: {} as never,
			listMembers: {} as never,
			revokeMember: {} as never,
			loginWithCredentials: {} as never,
			registerUser: {} as never,
			refreshSession: {} as never,
			startSession: {} as never,
			resumeSession: {} as never,
			endSession: {} as never,
			updateUserFullName: {} as never,
			acceptInvitations: {} as never,
			// The pending-invitations slice never reaches these; the explicit
			// `{} as never` records that the wiring is intentionally inert.
			listNotifications: {} as never,
			markNotificationsRead: {} as never,
			mediaUploadSigner: {} as never,
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
			requireUser: createRequireUser({ userRepository }),
			requireCompanyContext: (_request, _response, next) => next(),
			customers: {} as never,
			products: {} as never,
			movements: {} as never,
			suppliers: {} as never,
			authCookieOptions: {
				httpOnly: true,
				secure: false,
				sameSite: "lax",
				path: "/auth",
				maxAge: 30 * 24 * 60 * 60 * 1000,
			},
			corsOrigin: TEST_WEB_ORIGIN,
		});

		return {
			app,
			owner,
			invitee,
			companyRepository,
			membershipRepository,
		};
	}

	async function seedCompany(
		companyRepository: InMemoryCompanyRepository,
		owner: User,
		id: string,
		name: string,
	): Promise<Company> {
		return companyRepository.createOwnedBy(
			Company.create({ id, name, createdAt: INVITED_AT }),
			{ userId: owner.id, email: owner.email },
		);
	}

	function authorization(sub: string): string {
		return `Bearer ${issuer.signToken({ sub })}`;
	}

	it("answers 200 with the pending invitation and its company", async () => {
		const { app, owner, invitee, companyRepository, membershipRepository } =
			await createTestApp();
		await seedCompany(companyRepository, owner, "company-a", "Acme");
		membershipRepository.save(
			Membership.create({
				id: "membership-a",
				userId: null,
				invitedEmail: INVITEE_EMAIL,
				companyId: "company-a",
				role: "MEMBER",
				status: "INVITED",
				invitedBy: owner.id,
				acceptedAt: null,
				createdAt: INVITED_AT,
			}),
		);

		const response = await request(app)
			.get("/me/invitations")
			.set("authorization", authorization(invitee.auth0Sub));

		expect(response.status).toBe(200);
		expect(response.body).toEqual([
			{
				membershipId: "membership-a",
				companyId: "company-a",
				role: "MEMBER",
				invitedAt: INVITED_AT.toISOString(),
				company: {
					id: "company-a",
					name: "Acme",
					createdAt: INVITED_AT.toISOString(),
				},
				inviter: {
					id: owner.id,
					fullName: null,
					email: owner.email,
				},
			},
		]);
		// `status` is pinned by the query, so repeating it would be dead weight.
		expect(response.body[0]).not.toHaveProperty("status");
	});

	it("answers 200 with an empty array when nothing is pending", async () => {
		const { app, invitee } = await createTestApp();

		const response = await request(app)
			.get("/me/invitations")
			.set("authorization", authorization(invitee.auth0Sub));

		expect(response.status).toBe(200);
		expect(response.body).toEqual([]);
	});

	it("does not list an ACTIVE membership", async () => {
		const { app, owner, invitee, companyRepository, membershipRepository } =
			await createTestApp();
		await seedCompany(companyRepository, owner, "company-active", "Acme");
		await seedCompany(companyRepository, owner, "company-pending", "Globex");
		// The caller already belongs to one company; only the pending
		// invitation in the other is an invitation.
		membershipRepository.save(
			Membership.create({
				userId: invitee.id,
				invitedEmail: INVITEE_EMAIL,
				companyId: "company-active",
				role: "ADMIN",
				status: "ACTIVE",
				invitedBy: owner.id,
				acceptedAt: new Date(),
			}),
		);
		membershipRepository.save(
			Membership.create({
				id: "membership-pending",
				userId: null,
				invitedEmail: INVITEE_EMAIL,
				companyId: "company-pending",
				role: "MEMBER",
				status: "INVITED",
				invitedBy: owner.id,
				acceptedAt: null,
				createdAt: INVITED_AT,
			}),
		);

		const response = await request(app)
			.get("/me/invitations")
			.set("authorization", authorization(invitee.auth0Sub));

		expect(response.status).toBe(200);
		expect(
			response.body.map((item: { companyId: string }) => item.companyId),
		).toEqual(["company-pending"]);
	});

	it("does not list an invitation addressed to another email", async () => {
		const { app, owner, invitee, companyRepository, membershipRepository } =
			await createTestApp();
		await seedCompany(companyRepository, owner, "company-a", "Acme");
		membershipRepository.save(
			Membership.create({
				id: "membership-other",
				userId: null,
				invitedEmail: "someone-else@example.com",
				companyId: "company-a",
				role: "MEMBER",
				status: "INVITED",
				invitedBy: owner.id,
				acceptedAt: null,
			}),
		);

		const response = await request(app)
			.get("/me/invitations")
			.set("authorization", authorization(invitee.auth0Sub));

		expect(response.status).toBe(200);
		expect(response.body).toEqual([]);
	});

	it("answers 401 without a token", async () => {
		const { app } = await createTestApp();

		const response = await request(app).get("/me/invitations");

		expect(response.status).toBe(401);
	});

	it("answers 403 user_not_provisioned when the token resolves to no users row", async () => {
		const { app } = await createTestApp();

		const response = await request(app)
			.get("/me/invitations")
			.set("authorization", authorization("auth0|unknown"));

		expect(response.status).toBe(403);
		expect(response.body).toEqual({
			error: { message: "User not provisioned", code: "user_not_provisioned" },
		});
	});

	it("needs no company context: an invitee with no ACTIVE membership can call it", async () => {
		// Regression guard for the route mount: the caller is not a member of the
		// company yet, so putting this behind `requireCompanyContext` would make
		// the endpoint unreachable exactly for the person who needs it.
		const { app, owner, invitee, companyRepository, membershipRepository } =
			await createTestApp();
		await seedCompany(companyRepository, owner, "company-a", "Acme");
		membershipRepository.save(
			Membership.create({
				id: "membership-a",
				userId: null,
				invitedEmail: INVITEE_EMAIL,
				companyId: "company-a",
				role: "MEMBER",
				status: "INVITED",
				invitedBy: owner.id,
				acceptedAt: null,
				createdAt: INVITED_AT,
			}),
		);

		const response = await request(app)
			.get("/me/invitations")
			.set("authorization", authorization(invitee.auth0Sub));

		expect(response.status).toBe(200);
		expect(response.body).toHaveLength(1);
	});
});
