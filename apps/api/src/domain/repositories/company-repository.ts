import type { Company } from "../entities/company.js";

/**
 * The identity of the user who owns the company at birth.
 *
 * Per `docs/stack.md` §5.8 the owner *is* the membership with `role = OWNER`,
 * so "a company always has an owner" is a domain rule, not a technical detail.
 */
export interface CompanyOwner {
	userId: string;
	email: string;
}

/**
 * Port for company persistence.
 *
 * This is an interface only: `application` and `domain` depend on this
 * abstraction, and `infrastructure` provides the concrete implementation.
 */
export interface CompanyRepository {
	/** Creates the company together with its OWNER membership, atomically. */
	createOwnedBy(company: Company, owner: CompanyOwner): Promise<Company>;

	/** Lists the companies the given user belongs to. */
	findAllForUser(userId: string): Promise<Company[]>;

	/**
	 * Resolves the companies with the given ids.
	 *
	 * It is a batch read on purpose: the caller has already read N rows (the
	 * caller's pending invitations) and joining their companies one id at a
	 * time would be N+1. The result is not required to be complete or ordered
	 * -- an id with no company is simply absent -- so the caller joins in
	 * memory and drops whatever the read did not return.
	 */
	findByIds(ids: string[]): Promise<Company[]>;
}
