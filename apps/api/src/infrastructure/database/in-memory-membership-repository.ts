import { Membership } from "../../domain/entities/membership.js";
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

	/** Adapter-specific: lets the test suite insert memberships directly. */
	save(membership: Membership): void {
		this.memberships.set(membership.id, membership);
	}
}
