import { Customer } from "../../domain/entities/customer.js";
import type { CustomerRepository } from "../../domain/repositories/customer-repository.js";
import type {
	Customer as CustomerModel,
	PrismaClient,
} from "./generated/prisma/client.js";

/**
 * The adapter depends on the `customer` delegate only. The type-only import is
 * on purpose: the generated client is ESM-first and Jest runs through
 * `@swc/jest` in CommonJS, so a runtime import would break the suite.
 */
type CustomerDelegate = Pick<PrismaClient, "customer">;

export interface PrismaCustomerRepositoryDependencies {
	prisma: CustomerDelegate;
}

/**
 * Prisma-backed adapter for the {@link CustomerRepository} port.
 *
 * Rows are always mapped back to the domain entity; a raw Prisma object never
 * crosses the port boundary. Every statement carries the `companyId` in its
 * WHERE clause (EMP-03/S5), and every active read carries `deletedAt: null`, so
 * the isolation and the soft delete are decided by the query.
 *
 * There is no uniqueness handling: the schema has no unique index on the
 * customer email (L4), so there is no `P2002` to translate.
 */
export class PrismaCustomerRepository implements CustomerRepository {
	private readonly prisma: CustomerDelegate;

	constructor(dependencies: PrismaCustomerRepositoryDependencies) {
		this.prisma = dependencies.prisma;
	}

	async create(customer: Customer): Promise<Customer> {
		const row = await this.prisma.customer.create({
			data: {
				id: customer.id,
				companyId: customer.companyId,
				name: customer.name,
				email: customer.email,
				phone: customer.phone,
				address: customer.address,
				createdAt: customer.createdAt,
				updatedAt: customer.updatedAt,
			},
		});

		return this.toDomain(row);
	}

	async findActiveById(
		companyId: string,
		customerId: string,
	): Promise<Customer | null> {
		const row = await this.prisma.customer.findFirst({
			where: { id: customerId, companyId, deletedAt: null },
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	async findByIds(companyId: string, ids: string[]): Promise<Customer[]> {
		// No `deletedAt` filter: this is the history read of the stock
		// movements (MOV-05), so a soft-deleted customer of the company must
		// still resolve. The `companyId` stays in the WHERE clause, so the
		// isolation is the query's, not a post-filter's.
		const rows = await this.prisma.customer.findMany({
			where: { companyId, id: { in: ids } },
		});

		return rows.map((row) => this.toDomain(row));
	}

	async list(companyId: string, search?: string): Promise<Customer[]> {
		const needle = search?.trim();

		const rows = await this.prisma.customer.findMany({
			where: {
				companyId,
				deletedAt: null,
				...(needle === undefined || needle.length === 0
					? {}
					: {
							OR: [
								{ name: { contains: needle, mode: "insensitive" } },
								{ email: { contains: needle, mode: "insensitive" } },
								{ phone: { contains: needle, mode: "insensitive" } },
							],
						}),
			},
			// Deterministic order, so two reads of the same state answer the same
			// array.
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});

		return rows.map((row) => this.toDomain(row));
	}

	async update(customer: Customer): Promise<Customer | null> {
		// `updateMany` (not `update`) because it accepts the extra `deletedAt`
		// predicate: the write only lands while the row is still active, so a
		// delete racing this update wins instead of being overwritten.
		const { count } = await this.prisma.customer.updateMany({
			where: {
				id: customer.id,
				companyId: customer.companyId,
				deletedAt: null,
			},
			data: {
				name: customer.name,
				email: customer.email,
				phone: customer.phone,
				address: customer.address,
				updatedAt: customer.updatedAt,
			},
		});

		if (count === 0) {
			return null;
		}

		return this.findActiveById(customer.companyId, customer.id);
	}

	async softDelete(
		companyId: string,
		customerId: string,
		deletedAt: Date,
	): Promise<Customer | null> {
		// Guarded on `deletedAt: null`, so the second DELETE updates no row
		// instead of restamping the original date.
		const { count } = await this.prisma.customer.updateMany({
			where: { id: customerId, companyId, deletedAt: null },
			data: { deletedAt, updatedAt: deletedAt },
		});

		if (count === 0) {
			return null;
		}

		const row = await this.prisma.customer.findFirst({
			where: { id: customerId, companyId },
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	/** Maps a raw Prisma row back into the domain entity. */
	private toDomain(row: CustomerModel): Customer {
		return Customer.create({
			id: row.id,
			companyId: row.companyId,
			name: row.name,
			email: row.email,
			phone: row.phone,
			address: row.address,
			deletedAt: row.deletedAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}
}
