import { Company } from "../../domain/entities/company.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { PrismaClient } from "./generated/prisma/client.js";

/**
 * The adapter depends only on the Prisma `company` delegate, not on the whole
 * client, so the injected surface stays as small as the port needs. The
 * import is type-only on purpose: the generated client is ESM-first and Jest
 * runs through `@swc/jest` in CommonJS, so a runtime import would break the
 * test suite.
 */
type CompanyDelegate = Pick<PrismaClient, "company">;

export interface PrismaCompanyRepositoryDependencies {
	prisma: CompanyDelegate;
}

/**
 * Prisma-backed adapter for the {@link CompanyRepository} port.
 *
 * Rows are always mapped back to the domain entity; a raw Prisma object never
 * crosses the port boundary. The create path writes the id the domain entity
 * already generated, so the database default (`gen_random_uuid()`) is never
 * allowed to silently replace it.
 */
export class PrismaCompanyRepository implements CompanyRepository {
	private readonly prisma: CompanyDelegate;

	constructor(dependencies: PrismaCompanyRepositoryDependencies) {
		this.prisma = dependencies.prisma;
	}

	async create(company: Company): Promise<Company> {
		await this.prisma.company.create({
			data: {
				id: company.id,
				name: company.name,
				createdAt: company.createdAt,
			},
		});

		return company;
	}

	async findAll(): Promise<Company[]> {
		// Companies are global (not company-scoped), so there is no
		// `company_id` filter. The order is deterministic: creation order with
		// the unique id as a tie-breaker.
		const rows = await this.prisma.company.findMany({
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		});

		return rows.map((row) =>
			Company.create({ id: row.id, name: row.name, createdAt: row.createdAt }),
		);
	}
}
