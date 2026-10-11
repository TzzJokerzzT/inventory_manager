import { InviteMemberUseCase } from "../src/application/use-cases/invite-member.js";
import { Membership } from "../src/domain/entities/membership.js";
import { InsufficientRoleError } from "../src/domain/errors/insufficient-role-error.js";
import { MembershipAlreadyExistsError } from "../src/domain/errors/membership-already-exists-error.js";
import type { MembershipRepository } from "../src/domain/repositories/membership-repository.js";

function createMembershipRepository(
	existing: Membership | null = null,
): MembershipRepository & { invited: unknown[] } {
	const invited: unknown[] = [];
	return {
		invited,
		findActiveByUserAndCompany: async () => null,
		findActiveByUser: async () => [],
		findByEmailAndCompany: async () => existing,
		invite: async (input) => {
			invited.push(input);
			return Membership.create({
				...input,
				status: "INVITED",
				userId: null,
				acceptedAt: null,
			});
		},
	};
}

describe("InviteMemberUseCase", () => {
	describe("role-based authorization", () => {
		it("lets an OWNER invite a MEMBER", async () => {
			const repo = createMembershipRepository();
			const useCase = new InviteMemberUseCase({ membershipRepository: repo });

			await useCase.execute(
				{ email: "user@example.com", role: "MEMBER" },
				{
					companyId: "company-1",
					inviterId: "owner-1",
					inviterRole: "OWNER",
				},
			);

			expect(repo.invited).toHaveLength(1);
		});

		it("lets an OWNER invite an ADMIN", async () => {
			const repo = createMembershipRepository();
			const useCase = new InviteMemberUseCase({ membershipRepository: repo });

			await useCase.execute(
				{ email: "user@example.com", role: "ADMIN" },
				{
					companyId: "company-1",
					inviterId: "owner-1",
					inviterRole: "OWNER",
				},
			);

			expect(repo.invited).toHaveLength(1);
		});

		it("lets an OWNER invite another OWNER", async () => {
			const repo = createMembershipRepository();
			const useCase = new InviteMemberUseCase({ membershipRepository: repo });

			await useCase.execute(
				{ email: "user@example.com", role: "OWNER" },
				{
					companyId: "company-1",
					inviterId: "owner-1",
					inviterRole: "OWNER",
				},
			);

			expect(repo.invited).toHaveLength(1);
		});

		it("lets an ADMIN invite a MEMBER", async () => {
			const repo = createMembershipRepository();
			const useCase = new InviteMemberUseCase({ membershipRepository: repo });

			await useCase.execute(
				{ email: "user@example.com", role: "MEMBER" },
				{
					companyId: "company-1",
					inviterId: "admin-1",
					inviterRole: "ADMIN",
				},
			);

			expect(repo.invited).toHaveLength(1);
		});

		it("rejects an ADMIN inviting another ADMIN (only OWNER can assign ADMIN)", async () => {
			const repo = createMembershipRepository();
			const useCase = new InviteMemberUseCase({ membershipRepository: repo });

			await expect(
				useCase.execute(
					{ email: "user@example.com", role: "ADMIN" },
					{
						companyId: "company-1",
						inviterId: "admin-1",
						inviterRole: "ADMIN",
					},
				),
			).rejects.toThrow(InsufficientRoleError);
			expect(repo.invited).toHaveLength(0);
		});

		it("rejects an ADMIN inviting an OWNER", async () => {
			const repo = createMembershipRepository();
			const useCase = new InviteMemberUseCase({ membershipRepository: repo });

			await expect(
				useCase.execute(
					{ email: "user@example.com", role: "OWNER" },
					{
						companyId: "company-1",
						inviterId: "admin-1",
						inviterRole: "ADMIN",
					},
				),
			).rejects.toThrow(InsufficientRoleError);
			expect(repo.invited).toHaveLength(0);
		});

		it("rejects a MEMBER inviting anyone", async () => {
			const repo = createMembershipRepository();
			const useCase = new InviteMemberUseCase({ membershipRepository: repo });

			await expect(
				useCase.execute(
					{ email: "user@example.com", role: "MEMBER" },
					{
						companyId: "company-1",
						inviterId: "member-1",
						inviterRole: "MEMBER",
					},
				),
			).rejects.toThrow(InsufficientRoleError);
			expect(repo.invited).toHaveLength(0);
		});
	});

	describe("uniqueness validation", () => {
		it("rejects inviting a user who already has an ACTIVE membership", async () => {
			const existing = Membership.create({
				userId: "user-1",
				invitedEmail: "user@example.com",
				companyId: "company-1",
				role: "MEMBER",
				status: "ACTIVE",
				invitedBy: "owner-1",
				acceptedAt: new Date(),
			});
			const repo = createMembershipRepository(existing);
			const useCase = new InviteMemberUseCase({ membershipRepository: repo });

			await expect(
				useCase.execute(
					{ email: "user@example.com", role: "MEMBER" },
					{
						companyId: "company-1",
						inviterId: "owner-1",
						inviterRole: "OWNER",
					},
				),
			).rejects.toThrow(MembershipAlreadyExistsError);
			expect(repo.invited).toHaveLength(0);
		});

		it("rejects inviting a user who already has an INVITED membership", async () => {
			const existing = Membership.create({
				userId: null,
				invitedEmail: "user@example.com",
				companyId: "company-1",
				role: "MEMBER",
				status: "INVITED",
				invitedBy: "owner-1",
				acceptedAt: null,
			});
			const repo = createMembershipRepository(existing);
			const useCase = new InviteMemberUseCase({ membershipRepository: repo });

			await expect(
				useCase.execute(
					{ email: "user@example.com", role: "MEMBER" },
					{
						companyId: "company-1",
						inviterId: "owner-1",
						inviterRole: "OWNER",
					},
				),
			).rejects.toThrow(MembershipAlreadyExistsError);
			expect(repo.invited).toHaveLength(0);
		});

		it("allows inviting a user whose previous membership was REVOKED", async () => {
			const existing = Membership.create({
				userId: "user-1",
				invitedEmail: "user@example.com",
				companyId: "company-1",
				role: "MEMBER",
				status: "REVOKED",
				invitedBy: "owner-1",
				acceptedAt: new Date(),
			});
			const repo = createMembershipRepository(existing);
			const useCase = new InviteMemberUseCase({ membershipRepository: repo });

			await useCase.execute(
				{ email: "user@example.com", role: "MEMBER" },
				{
					companyId: "company-1",
					inviterId: "owner-1",
					inviterRole: "OWNER",
				},
			);

			expect(repo.invited).toHaveLength(1);
		});
	});

	describe("created membership", () => {
		it("creates a membership with status INVITED, userId null, acceptedAt null", async () => {
			const repo = createMembershipRepository();
			const useCase = new InviteMemberUseCase({ membershipRepository: repo });

			const membership = await useCase.execute(
				{ email: "user@example.com", role: "MEMBER" },
				{
					companyId: "company-1",
					inviterId: "owner-1",
					inviterRole: "OWNER",
				},
			);

			expect(membership.status).toBe("INVITED");
			expect(membership.userId).toBeNull();
			expect(membership.acceptedAt).toBeNull();
			expect(membership.invitedEmail).toBe("user@example.com");
			expect(membership.companyId).toBe("company-1");
			expect(membership.role).toBe("MEMBER");
			expect(membership.invitedBy).toBe("owner-1");
		});
	});
});
