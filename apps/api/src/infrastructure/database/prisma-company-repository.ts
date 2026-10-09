import { Company } from "../../domain/entities/company.js";
import type {
	CompanyOwner,
	CompanyRepository,
} from "../../domain/repositories/company-repository.js";
import type { PrismaClient } from "./generated/prisma/client.js";

/**
 * The adapter depends only on the Prisma `company` and `membership` delegates
 * plus `$transaction`, not on the whole client, so the injected surface stays
 * as small as the port needs. The import is type-only on purpose: the
 * generated client is ESM-first and Jest runs through `@swc/jest` in
 * CommonJS, so a runtime import would break the test suite.
 */
type CompanyDelegate = Pick<
	PrismaClient,
	"company" | "membership" | "$transaction"
>;

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

	async createOwnedBy(company: Company, owner: CompanyOwner): Promise<Company> {
		// The owner *is* the OWNER membership (docs/stack.md §5.8), so a
		// company must never exist without its owner: the company and its
		// membership are written in one transaction.
		//
		// `invited_by = user_id` is the documented bootstrap self-reference —
		// nobody invited them, they created their own company. It looks like a
		// bug later, which is exactly why it is called out here.
		await this.prisma.$transaction([
			this.prisma.company.create({
				data: {
					id: company.id,
					name: company.name,
					createdAt: company.createdAt,
				},
			}),
			this.prisma.membership.create({
				data: {
					userId: owner.userId,
					companyId: company.id,
					role: "OWNER",
					status: "ACTIVE",
					acceptedAt: new Date(),
					// Lowercased on purpose: the migration enforces
					// `CHECK (invited_email = lower(invited_email))`.
					invitedEmail: owner.email.toLowerCase(),
					invitedBy: owner.userId,
				},
			}),
		]);

		return company;
	}

	async findAllForUser(userId: string): Promise<Company[]> {
		// The companies the user belongs to: join through memberships and keep
		// only ACTIVE ones — a revoked or still-invited membership does not make
		// them a member. The order is deterministic: creation order with the
		// unique id as a tie-breaker.
		const rows = await this.prisma.company.findMany({
			where: {
				memberships: {
					some: {
						userId,
						status: "ACTIVE",
					},
				},
			},
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		});

		return rows.map((row) =>
			Company.create({ id: row.id, name: row.name, createdAt: row.createdAt }),
		);
	}
}
