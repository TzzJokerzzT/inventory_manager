import {
	Membership,
	type MembershipRole,
} from "../../domain/entities/membership.js";
import { LastActiveOwnerError } from "../../domain/errors/last-active-owner-error.js";
import type {
	AcceptMembershipInput,
	InviteMemberInput,
	MembershipRepository,
} from "../../domain/repositories/membership-repository.js";

/**
 * In-memory adapter for the {@link MembershipRepository} port.
 *
 * It exists so the middleware and the tests can resolve a company context
 * without a database. It applies the same `status: "ACTIVE"` filter as the
 * Prisma adapter, so the two stay interchangeable behind the port.
 */
export class InMemoryMembershipRepository implements MembershipRepository {
	private readonly memberships = new Map<string, Membership>();

	constructor(memberships: Membership[] = []) {
		for (const membership of memberships) {
			this.memberships.set(membership.id, membership);
		}
	}

	async findActiveByUserAndCompany(
		userId: string,
		companyId: string,
	): Promise<Membership | null> {
		// The status filter mirrors `prisma-membership-repository.ts`: a
		// REVOKED or still-INVITED membership never grants access, only ACTIVE.
		const membership = Array.from(this.memberships.values()).find(
			(m) =>
				m.userId === userId &&
				m.companyId === companyId &&
				m.status === "ACTIVE",
		);

		return membership ?? null;
	}

	async findActiveByUser(userId: string): Promise<Membership[]> {
		// Same `status: "ACTIVE"` rule as `findActiveByUserAndCompany`: an
		// INVITED or REVOKED membership is not access. The userId filter is what
		// keeps one user's memberships out of another user's `/me` response.
		return Array.from(this.memberships.values()).filter(
			(m) => m.userId === userId && m.status === "ACTIVE",
		);
	}

	async findByEmailAndCompany(
		email: string,
		companyId: string,
	): Promise<Membership | null> {
		// Any status matches on purpose: the caller (MI-45 uniqueness check)
		// decides whether a REVOKED row may be re-invited. The adapter mirrors
		// the Prisma one, which also omits a status filter here.
		const membership = Array.from(this.memberships.values()).find(
			(m) => m.invitedEmail === email && m.companyId === companyId,
		);

		return membership ?? null;
	}

	async invite(input: InviteMemberInput): Promise<Membership> {
		const membership = Membership.create({
			userId: null,
			invitedEmail: input.invitedEmail,
			companyId: input.companyId,
			role: input.role,
			status: "INVITED",
			invitedBy: input.invitedBy,
			acceptedAt: null,
		});

		this.memberships.set(membership.id, membership);

		return membership;
	}

	async findInvitedByEmail(email: string): Promise<Membership[]> {
		// Same `status: "INVITED"` rule as the Prisma adapter, so the two stay
		// interchangeable behind the port.
		return Array.from(this.memberships.values()).filter(
			(m) => m.invitedEmail === email && m.status === "INVITED",
		);
	}

	async accept(input: AcceptMembershipInput): Promise<Membership | null> {
		const existing = this.memberships.get(input.membershipId);

		// Fail-closed mirror of the Prisma `where: { status: "INVITED" }` guard: a
		// row that is no longer INVITED is not accepted, never revived.
		if (existing === undefined || existing.status !== "INVITED") {
			return null;
		}

		// The entity is immutable, so accepting builds the next state and
		// replaces the row under the same id.
		const accepted = Membership.create({
			id: existing.id,
			userId: input.userId,
			invitedEmail: existing.invitedEmail,
			companyId: existing.companyId,
			role: existing.role,
			status: "ACTIVE",
			invitedBy: existing.invitedBy,
			acceptedAt: new Date(),
			createdAt: existing.createdAt,
			updatedAt: existing.updatedAt,
		});

		this.memberships.set(accepted.id, accepted);

		return accepted;
	}

	async findByCompany(companyId: string): Promise<Membership[]> {
		// Same roster rule as the Prisma adapter: ACTIVE and INVITED, never
		// REVOKED. Ordering is stable by creation then id, as in the adapters
		// that hit the database.
		return Array.from(this.memberships.values())
			.filter(
				(m) =>
					m.companyId === companyId &&
					(m.status === "ACTIVE" || m.status === "INVITED"),
			)
			.sort(
				(a, b) =>
					a.createdAt.getTime() - b.createdAt.getTime() ||
					a.id.localeCompare(b.id),
			);
	}

	async findById(membershipId: string): Promise<Membership | null> {
		return this.memberships.get(membershipId) ?? null;
	}

	async updateRole(
		membershipId: string,
		role: MembershipRole,
	): Promise<Membership | null> {
		const existing = this.memberships.get(membershipId);

		// Mirrors the Prisma guard: only a row still in the roster changes role.
		if (
			existing === undefined ||
			(existing.status !== "ACTIVE" && existing.status !== "INVITED")
		) {
			return null;
		}

		this.assertOwnerSurvives(existing);

		const updated = Membership.create({
			id: existing.id,
			userId: existing.userId,
			invitedEmail: existing.invitedEmail,
			companyId: existing.companyId,
			role,
			status: existing.status,
			invitedBy: existing.invitedBy,
			acceptedAt: existing.acceptedAt,
			createdAt: existing.createdAt,
			updatedAt: existing.updatedAt,
		});

		this.memberships.set(updated.id, updated);

		return updated;
	}

	async revoke(membershipId: string): Promise<Membership | null> {
		const existing = this.memberships.get(membershipId);

		if (
			existing === undefined ||
			(existing.status !== "ACTIVE" && existing.status !== "INVITED")
		) {
			return null;
		}

		this.assertOwnerSurvives(existing);

		// Revoking is a status change, never a delete (§5.8): the row stays so the
		// historical movements keep pointing at a readable user.
		const revoked = Membership.create({
			id: existing.id,
			userId: existing.userId,
			invitedEmail: existing.invitedEmail,
			companyId: existing.companyId,
			role: existing.role,
			status: "REVOKED",
			invitedBy: existing.invitedBy,
			acceptedAt: existing.acceptedAt,
			createdAt: existing.createdAt,
			updatedAt: existing.updatedAt,
		});

		this.memberships.set(revoked.id, revoked);

		return revoked;
	}

	/** §5.8 invariant 4 lives in the write, mirroring the Prisma adapter. */
	private assertOwnerSurvives(membership: Membership): void {
		if (membership.role !== "OWNER" || membership.status !== "ACTIVE") {
			return;
		}

		const otherActiveOwners = Array.from(this.memberships.values()).filter(
			(m) =>
				m.companyId === membership.companyId &&
				m.role === "OWNER" &&
				m.status === "ACTIVE" &&
				m.id !== membership.id,
		).length;

		if (otherActiveOwners === 0) {
			throw new LastActiveOwnerError();
		}
	}

	async countActiveOwners(companyId: string): Promise<number> {
		return Array.from(this.memberships.values()).filter(
			(m) =>
				m.companyId === companyId &&
				m.role === "OWNER" &&
				m.status === "ACTIVE",
		).length;
	}

	/** Adapter-specific: lets the test suite insert memberships directly. */
	save(membership: Membership): void {
		this.memberships.set(membership.id, membership);
	}
}
