import type { Company } from "../entities/company.js";

/**
 * Port for company persistence.
 *
 * This is an interface only: `application` and `domain` depend on this
 * abstraction, and `infrastructure` provides the concrete implementation.
 */
export interface CompanyRepository {
	create(company: Company): Promise<Company>;
	findAll(): Promise<Company[]>;
}
