import type { Company } from "../../domain/entities/company.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";

/**
 * In-memory adapter for the {@link CompanyRepository} port.
 *
 * It exists so the use cases can run end to end today. The real Prisma adapter
 * arrives with its own pending task; this keeps the port honest in the
 * meantime and is also what the smoke test injects.
 */
export class InMemoryCompanyRepository implements CompanyRepository {
	private readonly companies = new Map<string, Company>();

	async create(company: Company): Promise<Company> {
		this.companies.set(company.id, company);
		return company;
	}

	async findAll(): Promise<Company[]> {
		return Array.from(this.companies.values());
	}
}
