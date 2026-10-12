import {
	Membership,
	type MembershipRole,
} from "../../domain/entities/membership.js";
import type {
	AcceptMembershipInput,
	InviteMemberInput,
	MembershipRepository,
} from "../../domain/repositories/membership-repository.js";
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

	async invite(input: InviteMemberInput): Promise<Membership> {
		const row = await this.prisma.membership.create({
			data: {
				invitedEmail: input.invitedEmail,
				companyId: input.companyId,
				role: input.role,
				status: "INVITED",
				invitedBy: input.invitedBy,
				userId: null,
				acceptedAt: null,
			},
		});

		return this.toDomain(row);
	}

	async findByEmailAndCompany(
		email: string,
		companyId: string,
	): Promise<Membership | null> {
		const row = await this.prisma.membership.findFirst({
			where: {
				invitedEmail: email,
				companyId,
			},
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	async findInvitedByEmail(email: string): Promise<Membership[]> {
		// `status: "INVITED"` is the same hard-coded rule the other lookups
		// apply, mirrored: here the still-pending rows are exactly the ones this
		// read must return, and an ACTIVE or REVOKED row must never appear.
		const rows = await this.prisma.membership.findMany({
			where: { invitedEmail: email, status: "INVITED" },
		});

		return rows.map((row) => this.toDomain(row));
	}

	async accept(input: AcceptMembershipInput): Promise<Membership | null> {
		// `updateMany` (not `update`) because it accepts the extra `status`
		// predicate: the write only lands while the row is still INVITED, so a
		// revocation racing this acceptance wins instead of being overwritten.
		const { count } = await this.prisma.membership.updateMany({
			where: { id: input.membershipId, status: "INVITED" },
			data: {
				userId: input.userId,
				status: "ACTIVE",
				acceptedAt: new Date(),
			},
		});

		if (count === 0) {
			return null;
		}

		const row = await this.prisma.membership.findUnique({
			where: { id: input.membershipId },
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	async findByCompany(companyId: string): Promise<Membership[]> {
		// `REVOKED` is excluded in the WHERE clause, so the database -- not the
		// mapping code -- decides what the roster is.
		const rows = await this.prisma.membership.findMany({
			where: { companyId, status: { in: ["ACTIVE", "INVITED"] } },
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		});

		return rows.map((row) => this.toDomain(row));
	}

	async findById(membershipId: string): Promise<Membership | null> {
		const row = await this.prisma.membership.findUnique({
			where: { id: membershipId },
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	async updateRole(
		membershipId: string,
		role: MembershipRole,
	): Promise<Membership | null> {
		// Same guarded-write shape as `accept()`: the status predicate is what
		// keeps a REVOKED row from being brought back into the roster.
		const { count } = await this.prisma.membership.updateMany({
			where: { id: membershipId, status: { in: ["ACTIVE", "INVITED"] } },
			data: { role },
		});

		if (count === 0) {
			return null;
		}

		return this.findById(membershipId);
	}

	async revoke(membershipId: string): Promise<Membership | null> {
		const { count } = await this.prisma.membership.updateMany({
			where: { id: membershipId, status: { in: ["ACTIVE", "INVITED"] } },
			data: { status: "REVOKED" },
		});

		if (count === 0) {
			return null;
		}

		return this.findById(membershipId);
	}

	async countActiveOwners(companyId: string): Promise<number> {
		return this.prisma.membership.count({
			where: { companyId, role: "OWNER", status: "ACTIVE" },
		});
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
