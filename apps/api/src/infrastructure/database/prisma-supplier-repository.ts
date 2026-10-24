import { Supplier } from "../../domain/entities/supplier.js";
import { SupplierNameAlreadyExistsError } from "../../domain/errors/supplier-name-already-exists-error.js";
import type { SupplierRepository } from "../../domain/repositories/supplier-repository.js";
import type {
	PrismaClient,
	Supplier as SupplierModel,
} from "./generated/prisma/client.js";

/**
 * The adapter depends on the `supplier` delegate only. The type-only import is
 * on purpose: the generated client is ESM-first and Jest runs through
 * `@swc/jest` in CommonJS, so a runtime import would break the suite.
 */
type SupplierDelegate = Pick<PrismaClient, "supplier">;

/**
 * Prisma reports a unique-constraint violation as `P2002`. The check is
 * structural because the generated client is imported type-only: there is no
 * `Prisma.PrismaClientKnownRequestError` value to narrow against.
 */
function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: unknown }).code === "P2002"
	);
}

export interface PrismaSupplierRepositoryDependencies {
	prisma: SupplierDelegate;
}

/**
 * Prisma-backed adapter for the {@link SupplierRepository} port.
 *
 * Rows are always mapped back to the domain entity; a raw Prisma object never
 * crosses the port boundary. Every statement carries the `companyId` in its
 * WHERE clause (EMP-03), and every active read carries `deletedAt: null`, so
 * the isolation and the soft delete are decided by the query.
 *
 * The name uniqueness is enforced by the `@@unique([companyId, name])` index and
 * translated here: `P2002` from a create or an update becomes
 * {@link SupplierNameAlreadyExistsError}, so the in-memory adapter and this one
 * answer the same error and no use case can tell which store answered.
 */
export class PrismaSupplierRepository implements SupplierRepository {
	private readonly prisma: SupplierDelegate;

	constructor(dependencies: PrismaSupplierRepositoryDependencies) {
		this.prisma = dependencies.prisma;
	}

	async create(supplier: Supplier): Promise<Supplier> {
		try {
			const row = await this.prisma.supplier.create({
				data: {
					id: supplier.id,
					companyId: supplier.companyId,
					name: supplier.name,
					contact: supplier.contact,
					createdAt: supplier.createdAt,
					updatedAt: supplier.updatedAt,
				},
			});

			return this.toDomain(row);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new SupplierNameAlreadyExistsError();
			}

			throw error;
		}
	}

	async findById(
		companyId: string,
		supplierId: string,
	): Promise<Supplier | null> {
		const row = await this.prisma.supplier.findFirst({
			where: { id: supplierId, companyId, deletedAt: null },
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	async findByIds(companyId: string, ids: string[]): Promise<Supplier[]> {
		// No `deletedAt` filter: the purchase lots of a supplier that was
		// soft-deleted afterwards must stay readable. The `companyId` stays in
		// the WHERE clause, so the isolation is the query's.
		const rows = await this.prisma.supplier.findMany({
			where: { companyId, id: { in: ids } },
		});

		return rows.map((row) => this.toDomain(row));
	}

	async listByCompany(companyId: string): Promise<Supplier[]> {
		const rows = await this.prisma.supplier.findMany({
			where: { companyId, deletedAt: null },
			// Deterministic order, so two reads of the same state answer the same
			// array.
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});

		return rows.map((row) => this.toDomain(row));
	}

	async update(supplier: Supplier): Promise<Supplier | null> {
		try {
			// `updateMany` (not `update`) because it accepts the extra `deletedAt`
			// predicate: the write only lands while the row is still active, so a
			// delete racing this update wins instead of being overwritten. The
			// unique index still fires inside the statement, which is why the
			// `P2002` translation wraps it too.
			const { count } = await this.prisma.supplier.updateMany({
				where: {
					id: supplier.id,
					companyId: supplier.companyId,
					deletedAt: null,
				},
				data: {
					name: supplier.name,
					contact: supplier.contact,
					updatedAt: supplier.updatedAt,
				},
			});

			if (count === 0) {
				return null;
			}
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new SupplierNameAlreadyExistsError();
			}

			throw error;
		}

		return this.findById(supplier.companyId, supplier.id);
	}

	async softDelete(
		companyId: string,
		supplierId: string,
		deletedAt: Date,
	): Promise<Supplier | null> {
		// Guarded on `deletedAt: null`, so the second DELETE updates no row
		// instead of restamping the original date.
		const { count } = await this.prisma.supplier.updateMany({
			where: { id: supplierId, companyId, deletedAt: null },
			data: { deletedAt, updatedAt: deletedAt },
		});

		if (count === 0) {
			return null;
		}

		// The row is read back including the stamp, which is why this is not
		// `findById`: that one only ever sees active rows.
		const row = await this.prisma.supplier.findFirst({
			where: { id: supplierId, companyId },
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	/** Maps a raw Prisma row back into the domain entity. */
	private toDomain(row: SupplierModel): Supplier {
		return Supplier.create({
			id: row.id,
			companyId: row.companyId,
			name: row.name,
			contact: row.contact,
			deletedAt: row.deletedAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}
}
