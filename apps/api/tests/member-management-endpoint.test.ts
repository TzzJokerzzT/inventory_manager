import request from "supertest";
import { ChangeMemberRoleUseCase } from "../src/application/use-cases/change-member-role.js";
import { InviteMemberUseCase } from "../src/application/use-cases/invite-member.js";
import { LeaveCompanyUseCase } from "../src/application/use-cases/leave-company.js";
import { ListMembersUseCase } from "../src/application/use-cases/list-members.js";
import { RevokeMembershipUseCase } from "../src/application/use-cases/revoke-membership.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
	type MembershipStatus,
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
const COMPANY = "11111111-2222-4333-8444-555555555555";
const OTHER_COMPANY = "99999999-8888-4777-8666-555555555555";

const OWNER_SUB = "auth0|owner";
const ADMIN_SUB = "auth0|admin";
const OTHER_ADMIN_SUB = "auth0|admin-2";
const MEMBER_SUB = "auth0|member";
const OUTSIDER_SUB = "auth0|outsider";

describe("member management endpoints", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	interface SeedOptions {
		membershipId?: string;
		companyId?: string;
		userId?: string | null;
		email?: string;
		role: MembershipRole;
		status?: MembershipStatus;
	}

	function createTestApp() {
		const membershipRepository = new InMemoryMembershipRepository();

		const owner = User.create({ auth0Sub: OWNER_SUB, email: "owner@x.com" });
		const admin = User.create({ auth0Sub: ADMIN_SUB, email: "admin@x.com" });
		const otherAdmin = User.create({
			auth0Sub: OTHER_ADMIN_SUB,
			email: "admin2@x.com",
		});
		const member = User.create({ auth0Sub: MEMBER_SUB, email: "member@x.com" });
		const outsider = User.create({
			auth0Sub: OUTSIDER_SUB,
			email: "outsider@x.com",
		});
		const userRepository = createFakeUserRepository([
			owner,
			admin,
			otherAdmin,
			member,
			outsider,
		]);

		function seed(options: SeedOptions): Membership {
			const membership = Membership.create({
				id: options.membershipId ?? globalThis.crypto.randomUUID(),
				userId: options.userId === undefined ? null : options.userId,
				invitedEmail: options.email ?? "someone@x.com",
				companyId: options.companyId ?? COMPANY,
				role: options.role,
				status: options.status ?? "ACTIVE",
				invitedBy: owner.id,
				acceptedAt:
					(options.status ?? "ACTIVE") === "ACTIVE" ? new Date() : null,
			});

			membershipRepository.save(membership);

			return membership;
		}

		// The context now carries the company name, so every company a scoped
		// request names has to exist in the store.
		const companyRepository = new InMemoryCompanyRepository();
		companyRepository.save(Company.create({ id: COMPANY, name: "Acme" }));
		companyRepository.save(
			Company.create({ id: OTHER_COMPANY, name: "Globex" }),
		);

		const app = buildApp({
			acceptInvitations: {} as never,
			changeMemberRole: new ChangeMemberRoleUseCase({ membershipRepository }),
			createCompany: {} as never,
			getCurrentUser: {} as never,
			inviteMember: new InviteMemberUseCase({ membershipRepository }),
			leaveCompany: new LeaveCompanyUseCase({ membershipRepository }),
			listCompanies: {} as never,
			listMembers: new ListMembersUseCase({ membershipRepository }),
			revokeMember: new RevokeMembershipUseCase({ membershipRepository }),
			loginWithCredentials: {} as never,
			registerUser: {} as never,
			refreshSession: {} as never,
			startSession: {} as never,
			resumeSession: {} as never,
			endSession: {} as never,
			updateUserFullName: {} as never,
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
			requireUser: createRequireUser({ userRepository }),
			requireCompanyContext: createRequireCompanyContext({
				membershipRepository,
				companyRepository,
			}),
			// The member-management slice never reaches these; the explicit
			// `{} as never` records that the wiring is intentionally inert.
			listNotifications: {} as never,
			listPendingInvitations: {} as never,
			markNotificationsRead: {} as never,
			mediaUploadSigner: {} as never,
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
			membershipRepository,
			seed,
			owner,
			admin,
			otherAdmin,
			member,
			outsider,
		};
	}

	function authorization(sub: string): string {
		return `Bearer ${issuer.signToken({ sub })}`;
	}

	describe("GET /companies/:companyId/members", () => {
		it("lists the roster: ACTIVE, INVITED and never REVOKED", async () => {
			const { app, seed, owner, member } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			seed({ role: "MEMBER", userId: member.id, email: member.email });
			seed({ role: "MEMBER", status: "INVITED", email: "pending@x.com" });
			seed({ role: "MEMBER", status: "REVOKED", email: "gone@x.com" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/members`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(200);
			expect(response.body).toHaveLength(3);
			expect(
				response.body
					.map((m: { invitedEmail: string }) => m.invitedEmail)
					.sort(),
			).toEqual(["member@x.com", "owner@x.com", "pending@x.com"]);
		});

		it("lets a MEMBER read the roster", async () => {
			const { app, seed, owner, member } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			seed({ role: "MEMBER", userId: member.id, email: member.email });

			const response = await request(app)
				.get(`/companies/${COMPANY}/members`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(response.body).toHaveLength(2);
		});

		it("answers the uniform 403 for a non-member", async () => {
			const { app, seed, owner } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });

			const response = await request(app)
				.get(`/companies/${COMPANY}/members`)
				.set("authorization", authorization(OUTSIDER_SUB));

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("company_access_forbidden");
		});

		it("answers 401 without a token", async () => {
			const { app } = createTestApp();

			const response = await request(app).get(`/companies/${COMPANY}/members`);

			expect(response.status).toBe(401);
		});
	});

	describe("PATCH /companies/:companyId/members/:membershipId", () => {
		it("lets an OWNER promote a MEMBER and answers the updated membership", async () => {
			const { app, seed, owner, member } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			const target = seed({
				role: "MEMBER",
				userId: member.id,
				email: member.email,
			});

			const response = await request(app)
				.patch(`/companies/${COMPANY}/members/${target.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ role: "ADMIN" });

			expect(response.status).toBe(200);
			expect(response.body.role).toBe("ADMIN");
		});

		it("answers 403 insufficient_role when an ADMIN grants ADMIN", async () => {
			const { app, seed, owner, admin, member } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			seed({ role: "ADMIN", userId: admin.id, email: admin.email });
			const target = seed({
				role: "MEMBER",
				userId: member.id,
				email: member.email,
			});

			const response = await request(app)
				.patch(`/companies/${COMPANY}/members/${target.id}`)
				.set("authorization", authorization(ADMIN_SUB))
				.send({ role: "ADMIN" });

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
		});

		it("answers 403 when the caller tries to change its own role", async () => {
			const { app, seed, owner } = createTestApp();
			const own = seed({
				role: "OWNER",
				userId: owner.id,
				email: owner.email,
			});

			const response = await request(app)
				.patch(`/companies/${COMPANY}/members/${own.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ role: "MEMBER" });

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
		});

		it("answers 404 for a membership of another company", async () => {
			const { app, seed, owner } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			const foreign = seed({
				role: "MEMBER",
				companyId: OTHER_COMPANY,
				email: "foreign@x.com",
			});

			const response = await request(app)
				.patch(`/companies/${COMPANY}/members/${foreign.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ role: "ADMIN" });

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("membership_not_found");
		});

		it("answers 404 for a REVOKED membership", async () => {
			const { app, seed, owner } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			const revoked = seed({
				role: "MEMBER",
				status: "REVOKED",
				email: "gone@x.com",
			});

			const response = await request(app)
				.patch(`/companies/${COMPANY}/members/${revoked.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ role: "ADMIN" });

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("membership_not_found");
		});

		it("answers 400 for an unknown role and for a malformed membership id", async () => {
			const { app, seed, owner, member } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			const target = seed({
				role: "MEMBER",
				userId: member.id,
				email: member.email,
			});

			const badRole = await request(app)
				.patch(`/companies/${COMPANY}/members/${target.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ role: "SUPERADMIN" });

			const badId = await request(app)
				.patch(`/companies/${COMPANY}/members/not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ role: "ADMIN" });

			expect(badRole.status).toBe(400);
			expect(badId.status).toBe(400);
		});
	});

	describe("DELETE /companies/:companyId/members/:membershipId", () => {
		it("lets an OWNER revoke a MEMBER and answers the REVOKED membership", async () => {
			const { app, seed, owner, member, membershipRepository } =
				createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			const target = seed({
				role: "MEMBER",
				userId: member.id,
				email: member.email,
			});

			const response = await request(app)
				.delete(`/companies/${COMPANY}/members/${target.id}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(200);
			expect(response.body.status).toBe("REVOKED");

			// The row survives the revocation: it is not a delete.
			const row = await membershipRepository.findById(target.id);
			expect(row?.status).toBe("REVOKED");
		});

		it("answers 403 insufficient_role when an ADMIN revokes another ADMIN", async () => {
			const { app, seed, owner, admin, otherAdmin } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			seed({ role: "ADMIN", userId: admin.id, email: admin.email });
			const target = seed({
				role: "ADMIN",
				userId: otherAdmin.id,
				email: otherAdmin.email,
			});

			const response = await request(app)
				.delete(`/companies/${COMPANY}/members/${target.id}`)
				.set("authorization", authorization(ADMIN_SUB));

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
		});

		it("answers 409 last_active_owner when revoking your own last-OWNER membership", async () => {
			const { app, seed, owner } = createTestApp();
			const own = seed({
				role: "OWNER",
				userId: owner.id,
				email: owner.email,
			});

			const response = await request(app)
				.delete(`/companies/${COMPANY}/members/${own.id}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("last_active_owner");
		});

		it("answers 404 for a membership that does not exist", async () => {
			const { app, seed, owner } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });

			const response = await request(app)
				.delete(
					`/companies/${COMPANY}/members/12345678-1234-4123-8123-123456789012`,
				)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("membership_not_found");
		});
	});

	describe("DELETE /companies/:companyId/members/me", () => {
		it("lets a MEMBER leave the company", async () => {
			const { app, seed, owner, member } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			const own = seed({
				role: "MEMBER",
				userId: member.id,
				email: member.email,
			});

			const response = await request(app)
				.delete(`/companies/${COMPANY}/members/me`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(response.body.id).toBe(own.id);
			expect(response.body.status).toBe("REVOKED");
		});

		it("loses access after leaving: the same request is then 403", async () => {
			const { app, seed, owner, member } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			seed({ role: "MEMBER", userId: member.id, email: member.email });

			const left = await request(app)
				.delete(`/companies/${COMPANY}/members/me`)
				.set("authorization", authorization(MEMBER_SUB));
			const after = await request(app)
				.delete(`/companies/${COMPANY}/members/me`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(left.status).toBe(200);
			expect(after.status).toBe(403);
			expect(after.body.error.code).toBe("company_access_forbidden");
		});

		it("answers 409 last_active_owner for the last active OWNER", async () => {
			const { app, seed, owner } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });

			const response = await request(app)
				.delete(`/companies/${COMPANY}/members/me`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("last_active_owner");
		});

		it("lets an OWNER leave when another active OWNER remains", async () => {
			const { app, seed, owner, otherAdmin } = createTestApp();
			seed({ role: "OWNER", userId: owner.id, email: owner.email });
			seed({
				role: "OWNER",
				userId: otherAdmin.id,
				email: otherAdmin.email,
			});

			const response = await request(app)
				.delete(`/companies/${COMPANY}/members/me`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(200);
			expect(response.body.status).toBe("REVOKED");
		});

		it("answers 401 without a token", async () => {
			const { app } = createTestApp();

			const response = await request(app).delete(
				`/companies/${COMPANY}/members/me`,
			);

			expect(response.status).toBe(401);
		});
	});
});
