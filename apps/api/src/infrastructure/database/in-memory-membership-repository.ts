import type { Membership } from "../../domain/entities/membership.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";

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

	/** Adapter-specific: lets the test suite insert memberships directly. */
	save(membership: Membership): void {
		this.memberships.set(membership.id, membership);
	}
}
