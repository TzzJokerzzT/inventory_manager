import { Membership } from "../../domain/entities/membership.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";
import type {
	Membership as MembershipModel,
	PrismaClient,
} from "./generated/prisma/client.js";

/**
 * The adapter depends only on the Prisma `membership` delegate, not on the
 * whole client, so the injected surface stays as small as the port needs. The
 * import is type-only on purpose: the generated client is ESM-first and Jest
 * runs through `@swc/jest` in CommonJS, so a runtime import would break the
 * test suite.
 */
type MembershipDelegate = Pick<PrismaClient, "membership">;

export interface PrismaMembershipRepositoryDependencies {
	prisma: MembershipDelegate;
}

/**
 * Prisma-backed adapter for the {@link MembershipRepository} port.
 *
 * Rows are always mapped back to the domain entity; a raw Prisma object never
 * crosses the port boundary. The lookup hard-codes `status: "ACTIVE"`, the
 * same rule `prisma-company-repository.ts` applies: a REVOKED or still-INVITED
 * membership must never come back as active access.
 */
export class PrismaMembershipRepository implements MembershipRepository {
	private readonly prisma: MembershipDelegate;

	constructor(dependencies: PrismaMembershipRepositoryDependencies) {
		this.prisma = dependencies.prisma;
	}

	async findActiveByUserAndCompany(
		userId: string,
		companyId: string,
	): Promise<Membership | null> {
		const row = await this.prisma.membership.findFirst({
			where: {
				userId,
				companyId,
				status: "ACTIVE",
			},
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	async findActiveByUser(userId: string): Promise<Membership[]> {
		// The `status: "ACTIVE"` hard-coded filter is the same rule
		// `findActiveByUserAndCompany` applies: an INVITED or REVOKED row must
		// never appear. The `userId` filter is what isolates one user's list
		// from another's, and it lives in the WHERE clause so the database -- not
		// the mapping code -- enforces it.
		const rows = await this.prisma.membership.findMany({
			where: { userId, status: "ACTIVE" },
		});

		return rows.map((row) => this.toDomain(row));
	}

	/** Maps a raw Prisma row back into the domain entity. */
	private toDomain(row: MembershipModel): Membership {
		return Membership.create({
			id: row.id,
			userId: row.userId,
			invitedEmail: row.invitedEmail,
			companyId: row.companyId,
			role: row.role,
			status: row.status,
			invitedBy: row.invitedBy,
			acceptedAt: row.acceptedAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}
}
