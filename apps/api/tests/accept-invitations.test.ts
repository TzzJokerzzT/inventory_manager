import { AcceptInvitationsUseCase } from "../src/application/use-cases/accept-invitations.js";
import {
	Membership,
	type MembershipStatus,
} from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import type { MembershipRepository } from "../src/domain/repositories/membership-repository.js";
import type { NotificationRepository } from "../src/domain/repositories/notification-repository.js";
import { InMemoryNotificationRepository } from "../src/infrastructure/database/in-memory-notification-repository.js";

const USER_ID = "user-1";
const USER_EMAIL = "invitee@example.com";
const INVITER_ID = "owner-1";

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
		invitedBy: INVITER_ID,
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
		// The acceptance tests never reach these roster/management reads; the
		// explicit `{} as never` records that they are intentionally absent.
		findByCompany: {} as never,
		findById: {} as never,
		updateRole: {} as never,
		revoke: {} as never,
		countActiveOwners: {} as never,
	};
}

function buildUseCase(
	membershipRepository: MembershipRepository,
	notificationRepository: NotificationRepository = new InMemoryNotificationRepository(),
): {
	useCase: AcceptInvitationsUseCase;
	notificationRepository: NotificationRepository;
} {
	return {
		useCase: new AcceptInvitationsUseCase({
			membershipRepository,
			notificationRepository,
		}),
		notificationRepository,
	};
}

describe("AcceptInvitationsUseCase", () => {
	it("accepts every pending invitation for the caller's email", async () => {
		const repository = createRepository([
			invited({ id: "membership-1" }),
			invited({ id: "membership-2" }),
		]);
		const { useCase } = buildUseCase(repository);

		const accepted = await useCase.execute(user());

		expect(accepted).toHaveLength(2);
		expect(repository.acceptedIds).toEqual(["membership-1", "membership-2"]);
	});

	it("asks the repository for the caller's own email", async () => {
		const repository = createRepository();
		const { useCase } = buildUseCase(repository);

		await useCase.execute(user(USER_ID, "Someone@Example.COM"));

		// `User` lowercases on construction, so the lookup key can never carry
		// the case the person typed.
		expect(repository.queriedEmails).toEqual(["someone@example.com"]);
	});

	it("returns the memberships already ACTIVE after accepting them", async () => {
		const repository = createRepository([invited({ id: "membership-1" })]);
		const { useCase } = buildUseCase(repository);

		const [accepted] = await useCase.execute(user());

		expect(accepted.status).toBe("ACTIVE");
		expect(accepted.userId).toBe(USER_ID);
		expect(accepted.acceptedAt).not.toBeNull();
		expect(accepted.companyId).toBe("company-1");
		expect(accepted.role).toBe("MEMBER");
	});

	it("returns an empty array when nothing is pending", async () => {
		const { useCase } = buildUseCase(createRepository());

		await expect(useCase.execute(user())).resolves.toEqual([]);
	});

	it("ignores memberships that stopped being INVITED before the write", async () => {
		// The repository refuses the write (a revocation or a concurrent
		// acceptance won the race); the use case must not report it as accepted.
		const repository = createRepository(
			[invited({ id: "membership-1" }), invited({ id: "membership-2" })],
			{ refuseIds: ["membership-1"] },
		);
		const { useCase } = buildUseCase(repository);

		const accepted = await useCase.execute(user());

		expect(accepted.map((m) => m.id)).toEqual(["membership-2"]);
	});

	it("never accepts an invitation addressed to another email", async () => {
		const repository = createRepository([
			invited({ id: "membership-1" }),
			invited({ id: "membership-other", email: "other@example.com" }),
		]);
		const { useCase } = buildUseCase(repository);

		const accepted = await useCase.execute(user());

		expect(accepted.map((m) => m.id)).toEqual(["membership-1"]);
		expect(repository.acceptedIds).toEqual(["membership-1"]);
	});

	it("never accepts a REVOKED membership", async () => {
		const repository = createRepository([
			invited({ id: "membership-1", status: "REVOKED" }),
		]);
		const { useCase } = buildUseCase(repository);

		await expect(useCase.execute(user())).resolves.toEqual([]);
		expect(repository.acceptedIds).toEqual([]);
	});

	it("is idempotent: a second run accepts nothing", async () => {
		const repository = createRepository([invited({ id: "membership-1" })]);
		const { useCase } = buildUseCase(repository);

		const first = await useCase.execute(user());
		const second = await useCase.execute(user());

		expect(first).toHaveLength(1);
		expect(second).toEqual([]);
	});
});

describe("AcceptInvitationsUseCase notifications", () => {
	it("records one accepted event for the inviter per accepted membership", async () => {
		const repository = createRepository([
			invited({ id: "membership-1" }),
			invited({ id: "membership-2" }),
		]);
		const { useCase, notificationRepository } = buildUseCase(repository);

		await useCase.execute(user());

		const events = await notificationRepository.findByUser(INVITER_ID);
		expect(events).toHaveLength(2);
		expect(events.map((event) => event.dedupeKey).sort()).toEqual([
			"membership.accepted:membership-1",
			"membership.accepted:membership-2",
		]);
		expect(events[0]?.type).toBe("membership.accepted");
		expect(events.map((event) => event.payload)).toEqual(
			expect.arrayContaining([
				{
					membershipId: "membership-1",
					companyId: "company-1",
					actorId: USER_ID,
				},
				{
					membershipId: "membership-2",
					companyId: "company-1",
					actorId: USER_ID,
				},
			]),
		);

		// The actor is the accepting user, recorded at accept time so the read
		// never has to infer who triggered the event.
		for (const event of events) {
			expect(event.payload.actorId).toBe(USER_ID);
		}
	});

	it("records no event when the guarded accept loses the race", async () => {
		// A revocation or a concurrent acceptance won: the use case reports
		// nothing accepted, and must therefore record no event either.
		const repository = createRepository([invited({ id: "membership-1" })], {
			refuseIds: ["membership-1"],
		});
		const { useCase, notificationRepository } = buildUseCase(repository);

		await useCase.execute(user());

		await expect(
			notificationRepository.findByUser(INVITER_ID),
		).resolves.toEqual([]);
	});

	it("does not double-record the event when the accept runs again", async () => {
		const repository = createRepository([invited({ id: "membership-1" })]);
		const { useCase, notificationRepository } = buildUseCase(repository);

		await useCase.execute(user());
		await useCase.execute(user());

		await expect(
			notificationRepository.findByUser(INVITER_ID),
		).resolves.toHaveLength(1);
	});

	it("does not fail the acceptance when the notification write fails", async () => {
		// The acceptance already happened; a secondary failure must not undo it
		// or turn the request into a 500. It must still be reported, though.
		const repository = createRepository([invited({ id: "membership-1" })]);
		const failingNotifications: NotificationRepository = {
			create: async () => {
				throw new Error("notification store is down");
			},
			findByUser: async () => [],
			markAllRead: async () => 0,
		};
		const consoleError = jest
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const { useCase } = buildUseCase(repository, failingNotifications);

		const accepted = await useCase.execute(user());

		expect(accepted.map((m) => m.id)).toEqual(["membership-1"]);
		expect(consoleError).toHaveBeenCalledWith(
			expect.stringContaining("membership-1"),
			expect.any(Error),
		);

		consoleError.mockRestore();
	});
});
