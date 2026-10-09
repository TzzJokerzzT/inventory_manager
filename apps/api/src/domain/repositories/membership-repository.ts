import type { Membership } from "../entities/membership.js";

/**
 * Port for membership persistence.
 *
 * This is an interface only: `application` and `domain` depend on this
 * abstraction, and `infrastructure` provides the concrete implementation. It
 * deliberately exposes only the query MI-50 needs today; the write surface
 * for MI-45/MI-46/MI-47 (assign, accept, list members) is out of scope and
 * must not be pre-built here.
 */
export interface MembershipRepository {
	/**
	 * Resolves the user's ACTIVE membership for the given company, or `null`
	 * when there is none. A REVOKED or still-INVITED membership never matches:
	 * only an ACTIVE membership grants access.
	 */
	findActiveByUserAndCompany(
		userId: string,
		companyId: string,
	): Promise<Membership | null>;
}
