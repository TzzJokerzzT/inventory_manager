import type { Membership, MembershipRole } from "../entities/membership.js";

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
export interface InviteMemberInput {
	/** The email of the user being invited. Must be lowercased by the caller. */
	invitedEmail: string;
	/** The company to invite the user to. */
	companyId: string;
	/** The role the user will have once they accept. */
	role: MembershipRole;
	/** The user ID of the inviter (the caller). */
	invitedBy: string;
}

export interface AcceptMembershipInput {
	/** The membership to accept. */
	membershipId: string;
	/** The user accepting it; becomes the membership's `userId`. */
	userId: string;
}

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

	/**
	 * Creates an INVITED membership for the given email.
	 *
	 * The caller is responsible for ensuring the email is normalized
	 * (trimmed + lowercased) and that no ACTIVE or INVITED membership already
	 * exists for this email + company pair. The method itself is a pure
	 * persistence operation.
	 *
	 * The created membership has:
	 * - `userId`: null (the user has not accepted yet)
	 * - `status`: INVITED
	 * - `acceptedAt`: null
	 *
	 * Returns the created membership.
	 */
	invite(input: InviteMemberInput): Promise<Membership>;

	/**
	 * Finds any membership (regardless of status) for the given email + company.
	 *
	 * Returns the membership if one exists, or null otherwise. This read is
	 * used by MI-45 to enforce the uniqueness invariant: a user cannot be
	 * invited to a company they already belong to (ACTIVE or INVITED).
	 */
	findByEmailAndCompany(
		email: string,
		companyId: string,
	): Promise<Membership | null>;

	/**
	 * Lists every INVITED membership addressed to the given email, across
	 * companies.
	 *
	 * Only `INVITED` rows are returned: an `ACTIVE` one is already accepted and a
	 * `REVOKED` one must never be revived. The caller passes the canonical
	 * (lowercased) email it owns -- `User.email` already is -- so the match never
	 * depends on the case the invitee was typed with.
	 *
	 * This is the read MI-46 uses to find what the caller still has to accept.
	 */
	findInvitedByEmail(email: string): Promise<Membership[]>;

	/**
	 * Accepts a pending invitation: sets `userId`, `status = ACTIVE` and
	 * `acceptedAt`, but only if the row is still `INVITED`.
	 *
	 * The `INVITED` guard is part of the contract, not an optimisation: a
	 * revocation that lands between the read and this write must not be undone
	 * by the acceptance racing it. Returns the updated membership, or `null`
	 * when the row was no longer `INVITED` (or no longer exists), which the
	 * caller treats as "nothing to accept".
	 */
	accept(input: AcceptMembershipInput): Promise<Membership | null>;

	/**
	 * Lists the membership roster of a company: `ACTIVE` and `INVITED` rows.
	 *
	 * `REVOKED` is excluded on purpose. A revoked row is not part of the roster
	 * any more -- it exists only so the historical stock movements keep pointing
	 * at a readable user (MOV-05) -- and showing it would make the listing look
	 * like the person is still a member. An invitation that has not been
	 * accepted *is* part of the roster: the UI has to show it, which is why it
	 * is returned with its `INVITED` status rather than hidden.
	 */
	findByCompany(companyId: string): Promise<Membership[]>;

	/**
	 * Resolves a single membership by id, whatever its status, or `null`.
	 *
	 * The caller is responsible for checking `companyId` against the company it
	 * is authorised for; this read is deliberately not company-scoped so that
	 * the use case can tell "no such membership" from "belongs to another
	 * company" and answer both the same way.
	 */
	findById(membershipId: string): Promise<Membership | null>;

	/**
	 * Changes the role of a membership that is still part of the roster.
	 *
	 * Guarded to `ACTIVE`/`INVITED` like `accept()` is guarded to `INVITED`: a
	 * `REVOKED` row must not be brought back by a role change, and returns
	 * `null` when nothing was updated.
	 *
	 * Like `revoke()`, it enforces §5.8 invariant 4 atomically.
	 */
	updateRole(
		membershipId: string,
		role: MembershipRole,
	): Promise<Membership | null>;

	/**
	 * Revokes a membership by setting `status = REVOKED` -- never by deleting
	 * the row (§5.8).
	 *
	 * Guarded to `ACTIVE`/`INVITED` so revoking twice is a `null` (nothing to
	 * do) rather than a second silent update.
	 *
	 * It also enforces §5.8 invariant 4 atomically, in the same statement.
	 */
	revoke(membershipId: string): Promise<Membership | null>;

	/**
	 * Counts the company's active OWNERs.
	 *
	 * This is the fact the last-OWNER invariant turns on, and it is a count, not
	 * a role: it is the one read the `leave` row of the matrix cannot express on
	 * its own. Only `ACTIVE` rows count -- an `INVITED` OWNER has not accepted,
	 * so it cannot be the OWNER that keeps the company alive.
	 */
	countActiveOwners(companyId: string): Promise<number>;
}
