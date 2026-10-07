import type { Company } from "../../domain/entities/company.js";
import type {
	CompanyOwner,
	CompanyRepository,
} from "../../domain/repositories/company-repository.js";

/**
 * The membership facts the bootstrap writes. This is an adapter-internal
 * record, not a domain entity: nothing reads or manipulates memberships yet
 * (MI-45 introduces the real entity when it needs one). It is exposed only so
 * the test suite can assert the bootstrap rule the way production's database
 * CHECK would.
 */
export interface InMemoryMembership {
	userId: string;
	companyId: string;
	role: "OWNER";
	status: "ACTIVE";
	invitedEmail: string;
	invitedBy: string;
	acceptedAt: Date;
}

/**
 * In-memory adapter for the {@link CompanyRepository} port.
 *
 * It exists so the use cases can run end to end today. The real Prisma adapter
 * persists the same rule over PostgreSQL; this one keeps the port honest in
 * the meantime and is also what the smoke test injects.
 */
export class InMemoryCompanyRepository implements CompanyRepository {
	private readonly companies = new Map<string, Company>();
	private readonly memberships = new Map<string, InMemoryMembership>();

	async createOwnedBy(company: Company, owner: CompanyOwner): Promise<Company> {
		this.companies.set(company.id, company);

		// The owner *is* the OWNER membership (docs/stack.md §5.8), so a
		// company can never exist without its owner. `invited_by = user_id` is
		// the bootstrap self-reference: nobody invited them, they created their
		// own company.
		this.memberships.set(company.id, {
			userId: owner.userId,
			companyId: company.id,
			role: "OWNER",
			status: "ACTIVE",
			invitedEmail: owner.email.toLowerCase(),
			invitedBy: owner.userId,
			acceptedAt: new Date(),
		});

		return company;
	}

	async findAllForUser(userId: string): Promise<Company[]> {
		// Every membership this adapter writes is an ACTIVE bootstrap OWNER
		// membership, so membership existence *is* membership here; MI-45
		// introduces INVITED/REVOKED and will need a status filter.
		const companyIds = new Set(
			Array.from(this.memberships.values())
				.filter((membership) => membership.userId === userId)
				.map((membership) => membership.companyId),
		);

		return Array.from(this.companies.values())
			.filter((company) => companyIds.has(company.id))
			.sort(
				(a, b) =>
					a.createdAt.getTime() - b.createdAt.getTime() ||
					a.id.localeCompare(b.id),
			);
	}

	/** Adapter-specific: lets the test suite assert the bootstrap membership. */
	listMemberships(): InMemoryMembership[] {
		return Array.from(this.memberships.values());
	}
}
