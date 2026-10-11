import { AcceptInvitationsUseCase } from "../src/application/use-cases/accept-invitations.js";
import {
	Membership,
	type MembershipStatus,
} from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import type { MembershipRepository } from "../src/domain/repositories/membership-repository.js";

const USER_ID = "user-1";
const USER_EMAIL = "invitee@example.com";

function user(id = USER_ID, email = USER_EMAIL): User {
	return User.create({ auth0Sub: `auth0|${id}`, email, id });
}

function invited(
	overrides: { id?: string; email?: string; status?: MembershipStatus } = {},
): Membership {
	return Membership.create({
		id: overrides.id ?? "membership-1",
		userId: null,
		invitedEmail: overrides.email ?? USER_EMAIL,
		companyId: "company-1",
		role: "MEMBER",
		status: overrides.status ?? "INVITED",
		invitedBy: "owner-1",
		acceptedAt: null,
	});
}

interface FakeRepository extends MembershipRepository {
	readonly acceptedIds: string[];
	readonly queriedEmails: string[];
}

/**
 * In-memory double for the write path under test. `findInvitedByEmail` filters
 * by email and status exactly like the adapters do, so a test cannot pass by
 * accident when the use case asks for the wrong email or the wrong state.
 */
function createRepository(
	memberships: Membership[] = [],
	options: { refuseIds?: string[] } = {},
): FakeRepository {
	const rows = [...memberships];
	const acceptedIds: string[] = [];
	const queriedEmails: string[] = [];
	const refuse = new Set(options.refuseIds ?? []);

	return {
		acceptedIds,
		queriedEmails,
		findActiveByUserAndCompany: async () => null,
		findActiveByUser: async () => rows.filter((m) => m.status === "ACTIVE"),
		findByEmailAndCompany: async () => null,
		invite: async () => {
			throw new Error("not used by this use case");
		},
		findInvitedByEmail: async (email) => {
			queriedEmails.push(email);
			return rows.filter(
				(m) => m.invitedEmail === email && m.status === "INVITED",
			);
		},
		accept: async ({ membershipId, userId }) => {
			if (refuse.has(membershipId)) {
				return null;
			}

			const existing = rows.find((m) => m.id === membershipId);
			if (existing === undefined || existing.status !== "INVITED") {
				return null;
			}

			const acceptedMembership = Membership.create({
				id: existing.id,
				userId,
				invitedEmail: existing.invitedEmail,
				companyId: existing.companyId,
				role: existing.role,
				status: "ACTIVE",
				invitedBy: existing.invitedBy,
				acceptedAt: new Date(),
				createdAt: existing.createdAt,
			});

			rows[rows.indexOf(existing)] = acceptedMembership;
			acceptedIds.push(membershipId);

			return acceptedMembership;
		},
	};
}

describe("AcceptInvitationsUseCase", () => {
	it("accepts every pending invitation for the caller's email", async () => {
		const repository = createRepository([
			invited({ id: "membership-1" }),
			invited({ id: "membership-2" }),
		]);
		const useCase = new AcceptInvitationsUseCase({
			membershipRepository: repository,
		});

		const accepted = await useCase.execute(user());

		expect(accepted).toHaveLength(2);
		expect(repository.acceptedIds).toEqual(["membership-1", "membership-2"]);
	});

	it("asks the repository for the caller's own email", async () => {
		const repository = createRepository();
		const useCase = new AcceptInvitationsUseCase({
			membershipRepository: repository,
		});

		await useCase.execute(user(USER_ID, "Someone@Example.COM"));

		// `User` lowercases on construction, so the lookup key can never carry
		// the case the person typed.
		expect(repository.queriedEmails).toEqual(["someone@example.com"]);
	});

	it("returns the memberships already ACTIVE after accepting them", async () => {
		const repository = createRepository([invited({ id: "membership-1" })]);
		const useCase = new AcceptInvitationsUseCase({
			membershipRepository: repository,
		});

		const [accepted] = await useCase.execute(user());

		expect(accepted.status).toBe("ACTIVE");
		expect(accepted.userId).toBe(USER_ID);
		expect(accepted.acceptedAt).not.toBeNull();
		expect(accepted.companyId).toBe("company-1");
		expect(accepted.role).toBe("MEMBER");
	});

	it("returns an empty array when nothing is pending", async () => {
		const repository = createRepository();
		const useCase = new AcceptInvitationsUseCase({
			membershipRepository: repository,
		});

		await expect(useCase.execute(user())).resolves.toEqual([]);
	});

	it("ignores memberships that stopped being INVITED before the write", async () => {
		// The repository refuses the write (a revocation or a concurrent
		// acceptance won the race); the use case must not report it as accepted.
		const repository = createRepository(
			[invited({ id: "membership-1" }), invited({ id: "membership-2" })],
			{ refuseIds: ["membership-1"] },
		);
		const useCase = new AcceptInvitationsUseCase({
			membershipRepository: repository,
		});

		const accepted = await useCase.execute(user());

		expect(accepted.map((m) => m.id)).toEqual(["membership-2"]);
	});

	it("never accepts an invitation addressed to another email", async () => {
		const repository = createRepository([
			invited({ id: "membership-1" }),
			invited({ id: "membership-other", email: "other@example.com" }),
		]);
		const useCase = new AcceptInvitationsUseCase({
			membershipRepository: repository,
		});

		const accepted = await useCase.execute(user());

		expect(accepted.map((m) => m.id)).toEqual(["membership-1"]);
		expect(repository.acceptedIds).toEqual(["membership-1"]);
	});

	it("never accepts a REVOKED membership", async () => {
		const repository = createRepository([
			invited({ id: "membership-1", status: "REVOKED" }),
		]);
		const useCase = new AcceptInvitationsUseCase({
			membershipRepository: repository,
		});

		await expect(useCase.execute(user())).resolves.toEqual([]);
		expect(repository.acceptedIds).toEqual([]);
	});

	it("is idempotent: a second run accepts nothing", async () => {
		const repository = createRepository([invited({ id: "membership-1" })]);
		const useCase = new AcceptInvitationsUseCase({
			membershipRepository: repository,
		});

		const first = await useCase.execute(user());
		const second = await useCase.execute(user());

		expect(first).toHaveLength(1);
		expect(second).toEqual([]);
	});
});
