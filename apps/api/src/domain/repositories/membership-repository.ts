import type { Membership } from "../entities/membership.js";

/**
 * Port for membership persistence.
 *
 * This is an interface only: `application` and `domain` depend on this
 * abstraction, and `infrastructure` provides the concrete implementation. It
 * deliberately exposes only the reads the features need today; the write
 * surface for MI-45/MI-46/MI-47 (assign, accept, list members) is out of scope
 * and must not be pre-built here. `findActiveByUser` is a *read* added for
 * `GET /me`, which needs the caller's memberships to bootstrap a session; that
 * is why it is legitimate scope even though those MI-45/MI-46/MI-47 writes
 * remain forbidden. The reason this port stays narrow is to keep the write
 * surface unbuilt, not to block the reads a new feature needs.
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

	/**
	 * Lists every ACTIVE membership the given user holds, across companies.
	 *
	 * Only `ACTIVE` memberships are returned: an `INVITED` or `REVOKED` row
	 * never matches, the same rule `findActiveByUserAndCompany` applies. Rows
	 * belonging to any other user are never returned, so a caller can treat the
	 * result as that user's own access set.
	 *
	 * This read is why `GET /me` does not have to fan out into one
	 * `findActiveByUserAndCompany` call per company (N+1). It joins with
	 * `CompanyRepository.findAllForUser` in the use case, not here.
	 */
	findActiveByUser(userId: string): Promise<Membership[]>;
}
