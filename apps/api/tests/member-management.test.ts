import { ChangeMemberRoleUseCase } from "../src/application/use-cases/change-member-role.js";
import { LeaveCompanyUseCase } from "../src/application/use-cases/leave-company.js";
import { ListMembersUseCase } from "../src/application/use-cases/list-members.js";
import { RevokeMembershipUseCase } from "../src/application/use-cases/revoke-membership.js";
import {
	Membership,
	type MembershipRole,
	type MembershipStatus,
} from "../src/domain/entities/membership.js";
import { InsufficientRoleError } from "../src/domain/errors/insufficient-role-error.js";
import { LastActiveOwnerError } from "../src/domain/errors/last-active-owner-error.js";
import { MembershipNotFoundError } from "../src/domain/errors/membership-not-found-error.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";
const OWNER_ID = "owner-1";
const ADMIN_ID = "admin-1";
const OTHER_ADMIN_ID = "admin-2";
const MEMBER_ID = "member-1";

interface SeedInput {
	id: string;
	companyId?: string;
	userId?: string | null;
	email?: string;
	role: MembershipRole;
	status?: MembershipStatus;
}

function seed<T extends InMemoryMembershipRepository>(
	repository: T,
	input: SeedInput,
): Membership {
	const membership = Membership.create({
		id: input.id,
		userId: input.userId === undefined ? `user-${input.id}` : input.userId,
		invitedEmail: input.email ?? `${input.id}@example.com`,
		companyId: input.companyId ?? COMPANY,
		role: input.role,
		status: input.status ?? "ACTIVE",
		invitedBy: OWNER_ID,
		acceptedAt: (input.status ?? "ACTIVE") === "ACTIVE" ? new Date() : null,
	});

	repository.save(membership);

	return membership;
}

/**
 * A roster with all three roles (and two ADMINs, so a rule about acting on
 * *another* ADMIN is not confused with the rule about your own membership),
 * one pending invitation, one revoked row and a membership in another company.
 */
function seedRoster<T extends InMemoryMembershipRepository>(
	repository: T = new InMemoryMembershipRepository() as T,
): T {
	seed(repository, { id: "m-owner", userId: OWNER_ID, role: "OWNER" });
	seed(repository, { id: "m-admin", userId: ADMIN_ID, role: "ADMIN" });
	seed(repository, {
		id: "m-admin-2",
		userId: OTHER_ADMIN_ID,
		role: "ADMIN",
	});
	seed(repository, { id: "m-member", userId: MEMBER_ID, role: "MEMBER" });
	seed(repository, {
		id: "m-invited",
		userId: null,
		role: "MEMBER",
		status: "INVITED",
	});
	seed(repository, {
		id: "m-revoked",
		userId: "gone-1",
		role: "MEMBER",
		status: "REVOKED",
	});
	seed(repository, {
		id: "m-other-company",
		userId: "outsider-1",
		companyId: OTHER_COMPANY,
		role: "OWNER",
	});

	return repository;
}

/** A store where the caller's OWNER context exists but the count says otherwise. */
class SingleActiveOwnerRepository extends InMemoryMembershipRepository {
	override async countActiveOwners(): Promise<number> {
		return 1;
	}
}

describe("ListMembersUseCase", () => {
	function useCase(): ListMembersUseCase {
		return new ListMembersUseCase({ membershipRepository: seedRoster() });
	}

	it("returns the company's ACTIVE and INVITED memberships, never REVOKED", async () => {
		const members = await useCase().execute({
			companyId: COMPANY,
			actorRole: "OWNER",
		});

		expect(members.map((m) => m.id).sort()).toEqual([
			"m-admin",
			"m-admin-2",
			"m-invited",
			"m-member",
			"m-owner",
		]);
		expect(members.some((m) => m.status === "REVOKED")).toBe(false);
	});

	it("lets a MEMBER list, because the scoping is the company, not the role", async () => {
		await expect(
			useCase().execute({ companyId: COMPANY, actorRole: "MEMBER" }),
		).resolves.toHaveLength(5);
	});

	it("never returns another company's memberships", async () => {
		const members = await useCase().execute({
			companyId: COMPANY,
			actorRole: "OWNER",
		});

		expect(members.some((m) => m.id === "m-other-company")).toBe(false);
	});

	it("returns an empty roster for a company with no memberships", async () => {
		const listMembers = new ListMembersUseCase({
			membershipRepository: new InMemoryMembershipRepository(),
		});

		await expect(
			listMembers.execute({ companyId: COMPANY, actorRole: "OWNER" }),
		).resolves.toEqual([]);
	});
});

describe("ChangeMemberRoleUseCase", () => {
	function context(actorRole: MembershipRole, actorId: string = OWNER_ID) {
		return { companyId: COMPANY, actorId, actorRole };
	}

	it("lets an OWNER promote a MEMBER to ADMIN", async () => {
		const change = new ChangeMemberRoleUseCase({
			membershipRepository: seedRoster(),
		});

		const updated = await change.execute(
			{ membershipId: "m-member", role: "ADMIN" },
			context("OWNER"),
		);

		expect(updated.role).toBe("ADMIN");
		expect(updated.status).toBe("ACTIVE");
	});

	it("lets an OWNER demote an ADMIN to MEMBER", async () => {
		const change = new ChangeMemberRoleUseCase({
			membershipRepository: seedRoster(),
		});

		const updated = await change.execute(
			{ membershipId: "m-admin-2", role: "MEMBER" },
			context("OWNER"),
		);

		expect(updated.role).toBe("MEMBER");
	});

	it("rejects an ADMIN granting ADMIN to a MEMBER", async () => {
		const change = new ChangeMemberRoleUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			change.execute(
				{ membershipId: "m-member", role: "ADMIN" },
				context("ADMIN", ADMIN_ID),
			),
		).rejects.toThrow(InsufficientRoleError);
	});

	it("rejects an ADMIN demoting another ADMIN, because removing ADMIN is an OWNER action", async () => {
		const change = new ChangeMemberRoleUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			change.execute(
				{ membershipId: "m-admin-2", role: "MEMBER" },
				context("ADMIN", ADMIN_ID),
			),
		).rejects.toThrow(InsufficientRoleError);
	});

	it("rejects a MEMBER changing anyone's role", async () => {
		const change = new ChangeMemberRoleUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			change.execute(
				{ membershipId: "m-member", role: "ADMIN" },
				context("MEMBER", MEMBER_ID),
			),
		).rejects.toThrow(InsufficientRoleError);
	});

	it("rejects changing your own role, even as an OWNER", async () => {
		const change = new ChangeMemberRoleUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			change.execute(
				{ membershipId: "m-owner", role: "MEMBER" },
				context("OWNER", OWNER_ID),
			),
		).rejects.toThrow(InsufficientRoleError);
	});

	it("is an idempotent no-op when the role is the one it already has", async () => {
		const change = new ChangeMemberRoleUseCase({
			membershipRepository: seedRoster(),
		});

		const updated = await change.execute(
			{ membershipId: "m-member", role: "MEMBER" },
			context("OWNER"),
		);

		expect(updated.role).toBe("MEMBER");
	});

	it("answers MembershipNotFoundError for another company's membership", async () => {
		const change = new ChangeMemberRoleUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			change.execute(
				{ membershipId: "m-other-company", role: "ADMIN" },
				context("OWNER"),
			),
		).rejects.toThrow(MembershipNotFoundError);
	});

	it("answers MembershipNotFoundError for a REVOKED membership", async () => {
		const change = new ChangeMemberRoleUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			change.execute(
				{ membershipId: "m-revoked", role: "ADMIN" },
				context("OWNER"),
			),
		).rejects.toThrow(MembershipNotFoundError);
	});

	it("answers MembershipNotFoundError for a membership that does not exist", async () => {
		const change = new ChangeMemberRoleUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			change.execute(
				{ membershipId: "m-nope", role: "MEMBER" },
				context("OWNER"),
			),
		).rejects.toThrow(MembershipNotFoundError);
	});

	it("refuses to demote an ACTIVE OWNER when the count says it is the last one", async () => {
		// Reachable in a real store through a race: the caller's OWNER context was
		// resolved and then removed before this write, so the target became the
		// last active OWNER. The guard makes that leftover state impossible
		// instead of merely unlikely.
		const repository = seedRoster(new SingleActiveOwnerRepository());
		seed(repository, { id: "m-owner-2", userId: "owner-2", role: "OWNER" });

		const change = new ChangeMemberRoleUseCase({
			membershipRepository: repository,
		});

		await expect(
			change.execute(
				{ membershipId: "m-owner-2", role: "MEMBER" },
				context("OWNER", OWNER_ID),
			),
		).rejects.toThrow(LastActiveOwnerError);
	});

	it("reports MembershipNotFoundError when the guarded write loses the race", async () => {
		class LostRaceRepository extends InMemoryMembershipRepository {
			override async updateRole(): Promise<Membership | null> {
				return null;
			}
		}

		const change = new ChangeMemberRoleUseCase({
			membershipRepository: seedRoster(new LostRaceRepository()),
		});

		await expect(
			change.execute(
				{ membershipId: "m-member", role: "ADMIN" },
				context("OWNER"),
			),
		).rejects.toThrow(MembershipNotFoundError);
	});
});

describe("RevokeMembershipUseCase", () => {
	function context(actorRole: MembershipRole, actorId: string = OWNER_ID) {
		return { companyId: COMPANY, actorId, actorRole };
	}

	it("lets an OWNER revoke a MEMBER, marking the row REVOKED instead of deleting it", async () => {
		const repository = seedRoster();
		const revoke = new RevokeMembershipUseCase({
			membershipRepository: repository,
		});

		const revoked = await revoke.execute(
			{ membershipId: "m-member" },
			context("OWNER"),
		);

		expect(revoked.status).toBe("REVOKED");
		// The row is still there: the historical movements must keep pointing at
		// a readable user (§5.8, MOV-05).
		expect((await repository.findById("m-member"))?.status).toBe("REVOKED");
	});

	it("lets an ADMIN revoke a MEMBER", async () => {
		const revoke = new RevokeMembershipUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			revoke.execute({ membershipId: "m-member" }, context("ADMIN", ADMIN_ID)),
		).resolves.toMatchObject({ status: "REVOKED" });
	});

	it("rejects an ADMIN revoking another ADMIN", async () => {
		const revoke = new RevokeMembershipUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			revoke.execute({ membershipId: "m-admin-2" }, context("ADMIN", ADMIN_ID)),
		).rejects.toThrow(InsufficientRoleError);
	});

	it("rejects a MEMBER revoking anyone", async () => {
		const revoke = new RevokeMembershipUseCase({
			membershipRepository: seedRoster(),
		});

		// Targeted at somebody else: revoking your *own* membership is leaving,
		// which anyone may do, and it has its own cases below.
		await expect(
			revoke.execute(
				{ membershipId: "m-admin-2" },
				context("MEMBER", MEMBER_ID),
			),
		).rejects.toThrow(InsufficientRoleError);
	});

	it("treats revoking your own membership as leaving, allowed when another OWNER remains", async () => {
		const repository = seedRoster();
		seed(repository, { id: "m-owner-2", userId: "owner-2", role: "OWNER" });
		const revoke = new RevokeMembershipUseCase({
			membershipRepository: repository,
		});

		await expect(
			revoke.execute({ membershipId: "m-owner" }, context("OWNER", OWNER_ID)),
		).resolves.toMatchObject({ status: "REVOKED" });
	});

	it("rejects revoking your own membership when you are the last active OWNER", async () => {
		const revoke = new RevokeMembershipUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			revoke.execute({ membershipId: "m-owner" }, context("OWNER", OWNER_ID)),
		).rejects.toThrow(LastActiveOwnerError);
	});

	it("lets a pending invitation be revoked, which is how an invite is cancelled", async () => {
		const revoke = new RevokeMembershipUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			revoke.execute({ membershipId: "m-invited" }, context("OWNER")),
		).resolves.toMatchObject({ status: "REVOKED" });
	});

	it("answers MembershipNotFoundError for another company's membership", async () => {
		const revoke = new RevokeMembershipUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			revoke.execute({ membershipId: "m-other-company" }, context("OWNER")),
		).rejects.toThrow(MembershipNotFoundError);
	});

	it("answers MembershipNotFoundError for an already REVOKED membership", async () => {
		const revoke = new RevokeMembershipUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			revoke.execute({ membershipId: "m-revoked" }, context("OWNER")),
		).rejects.toThrow(MembershipNotFoundError);
	});

	it("reports MembershipNotFoundError when the guarded write loses the race", async () => {
		class LostRaceRepository extends InMemoryMembershipRepository {
			override async revoke(): Promise<Membership | null> {
				return null;
			}
		}

		const revoke = new RevokeMembershipUseCase({
			membershipRepository: seedRoster(new LostRaceRepository()),
		});

		await expect(
			revoke.execute({ membershipId: "m-member" }, context("OWNER")),
		).rejects.toThrow(MembershipNotFoundError);
	});
});

describe("LeaveCompanyUseCase", () => {
	function context(actorId: string, actorRole: MembershipRole) {
		return { companyId: COMPANY, actorId, actorRole };
	}

	it("lets a MEMBER leave", async () => {
		const repository = seedRoster();
		const leave = new LeaveCompanyUseCase({
			membershipRepository: repository,
		});

		const left = await leave.execute(context(MEMBER_ID, "MEMBER"));

		expect(left.id).toBe("m-member");
		expect(left.status).toBe("REVOKED");
	});

	it("lets an ADMIN leave", async () => {
		const leave = new LeaveCompanyUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(
			leave.execute(context(ADMIN_ID, "ADMIN")),
		).resolves.toMatchObject({ status: "REVOKED" });
	});

	it("lets an OWNER leave when another active OWNER remains", async () => {
		const repository = seedRoster();
		seed(repository, { id: "m-owner-2", userId: "owner-2", role: "OWNER" });
		const leave = new LeaveCompanyUseCase({
			membershipRepository: repository,
		});

		await expect(
			leave.execute(context(OWNER_ID, "OWNER")),
		).resolves.toMatchObject({ status: "REVOKED" });
	});

	it("refuses to let the last active OWNER leave (invariant 4)", async () => {
		const leave = new LeaveCompanyUseCase({
			membershipRepository: seedRoster(),
		});

		await expect(leave.execute(context(OWNER_ID, "OWNER"))).rejects.toThrow(
			LastActiveOwnerError,
		);
	});

	it("answers MembershipNotFoundError when the membership vanished", async () => {
		const leave = new LeaveCompanyUseCase({
			membershipRepository: new InMemoryMembershipRepository(),
		});

		await expect(leave.execute(context(OWNER_ID, "OWNER"))).rejects.toThrow(
			MembershipNotFoundError,
		);
	});
});
