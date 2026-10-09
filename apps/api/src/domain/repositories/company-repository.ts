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
}
