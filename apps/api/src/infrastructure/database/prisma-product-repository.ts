import { Product } from "../../domain/entities/product.js";
import { DomainError } from "../../domain/errors/domain-error.js";
import { SkuAlreadyExistsError } from "../../domain/errors/sku-already-exists-error.js";
import type {
	ListProductsOptions,
	ProductRepository,
	PurgeProductResult,
} from "../../domain/repositories/product-repository.js";
import type {
	PrismaClient,
	Product as ProductModel,
} from "./generated/prisma/client.js";

/**
 * The adapter depends on the `product` delegate only. The type-only import is
 * on purpose: the generated client is ESM-first and Jest runs through
 * `@swc/jest` in CommonJS, so a runtime import (and therefore an
 * `instanceof Prisma.Decimal`) would break the suite. Everything below treats
 * the row structurally instead.
 */
type ProductDelegate = Pick<PrismaClient, "product">;

/**
 * A `Decimal(12,2)` column comes back as a `Decimal` object, not a number. The
 * adapter may not `instanceof` it (see above) and may not go through a float,
 * so it reads `toString()` -- which carries the full precision -- and lets the
 * entity pad it to two decimals. That is the only string->string step in the
 * whole price path.
 */
function priceFromRow(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number") {
		return String(value);
	}

	if (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { toString?: unknown }).toString === "function"
	) {
		return (value as { toString: () => string }).toString();
	}

	throw new DomainError("Product price could not be read from the database");
}

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

/**
 * A movement of the product makes the database reject the delete
 * (`ON DELETE RESTRICT`), which Prisma reports as `P2003`. The check is
 * structural for the same reason as the one above: there is no
 * `Prisma.PrismaClientKnownRequestError` value to narrow against.
 */
function isForeignKeyViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: unknown }).code === "P2003"
	);
}

export interface PrismaProductRepositoryDependencies {
	prisma: ProductDelegate;
}

/**
 * Prisma-backed adapter for the {@link ProductRepository} port.
 *
 * Rows are always mapped back to the domain entity; a raw Prisma object never
 * crosses the port boundary. Every statement carries the `companyId` in its
 * WHERE clause (EMP-03), and every active read carries `deletedAt: null`, so
 * the isolation and the soft delete are decided by the query.
 */
export class PrismaProductRepository implements ProductRepository {
	private readonly prisma: ProductDelegate;

	constructor(dependencies: PrismaProductRepositoryDependencies) {
		this.prisma = dependencies.prisma;
	}

	async create(product: Product): Promise<Product> {
		try {
			const row = await this.prisma.product.create({
				data: {
					id: product.id,
					companyId: product.companyId,
					name: product.name,
					description: product.description,
					sku: product.sku,
					price: product.price,
					photoUrl: product.photoUrl,
					stockQuantity: product.stockQuantity,
					lowStockThreshold: product.lowStockThreshold,
					measureUnit: product.measureUnit,
					categoryId: product.categoryId,
					createdAt: product.createdAt,
					updatedAt: product.updatedAt,
				},
			});

			return this.toDomain(row);
		} catch (error) {
			// Two concurrent creates both pass the use case's check; the unique
			// index is the authority, so the violation is translated into the same
			// domain error instead of leaking a 500.
			if (isUniqueViolation(error)) {
				throw new SkuAlreadyExistsError();
			}

			throw error;
		}
	}

	async findActiveById(
		companyId: string,
		productId: string,
	): Promise<Product | null> {
		const row = await this.prisma.product.findFirst({
			where: { id: productId, companyId, deletedAt: null },
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	async findBySku(companyId: string, sku: string): Promise<Product | null> {
		// No `deletedAt` filter: the soft-deleted rows are exactly the ones that
		// keep a SKU reserved.
		const row = await this.prisma.product.findFirst({
			where: { companyId, sku },
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	async findByIds(companyId: string, ids: string[]): Promise<Product[]> {
		// No `deletedAt` filter: this is the history read of the stock
		// movements (MOV-05), so a soft-deleted product of the company must
		// still resolve. The `companyId` stays in the WHERE clause, so the
		// isolation is the query's, not a post-filter's.
		const rows = await this.prisma.product.findMany({
			where: { companyId, id: { in: ids } },
		});

		return rows.map((row) => this.toDomain(row));
	}

	async list(
		companyId: string,
		options: ListProductsOptions = {},
	): Promise<Product[]> {
		const needle = options.search?.trim();
		// The trash replaces the active filter instead of being added to it: a
		// view that mixed both would serve neither (L3).
		const deleted = options.deleted === true;

		const rows = await this.prisma.product.findMany({
			where: {
				companyId,
				deletedAt: deleted ? { not: null } : null,
				...(needle === undefined || needle.length === 0
					? {}
					: {
							OR: [
								{ name: { contains: needle, mode: "insensitive" } },
								{ sku: { contains: needle, mode: "insensitive" } },
							],
						}),
			},
			// Deterministic order, so two reads of the same state answer the same
			// array.
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});

		return rows.map((row) => this.toDomain(row));
	}

	async update(product: Product): Promise<Product | null> {
		// `updateMany` (not `update`) because it accepts the extra `deletedAt`
		// predicate: the write only lands while the row is still active, so a
		// delete racing this update wins instead of being overwritten.
		let count: number;
		try {
			({ count } = await this.prisma.product.updateMany({
				where: {
					id: product.id,
					companyId: product.companyId,
					deletedAt: null,
				},
				data: {
					name: product.name,
					description: product.description,
					sku: product.sku,
					price: product.price,
					photoUrl: product.photoUrl,
					updatedAt: product.updatedAt,
				},
			}));
		} catch (error) {
			// A concurrent create could have taken the SKU between the check and
			// this write; the index is the authority.
			if (isUniqueViolation(error)) {
				throw new SkuAlreadyExistsError();
			}

			throw error;
		}

		if (count === 0) {
			return null;
		}

		return this.findActiveById(product.companyId, product.id);
	}

	async softDelete(
		companyId: string,
		productId: string,
	): Promise<Product | null> {
		const now = new Date();

		// Guarded on `deletedAt: null`, so the second DELETE updates no row
		// instead of restamping the original date.
		const { count } = await this.prisma.product.updateMany({
			where: { id: productId, companyId, deletedAt: null },
			data: { deletedAt: now, updatedAt: now },
		});

		if (count === 0) {
			return null;
		}

		const row = await this.prisma.product.findFirst({
			where: { id: productId, companyId },
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	async restore(companyId: string, productId: string): Promise<Product | null> {
		const now = new Date();

		// The mirror guard of `softDelete`: only a row that is currently in the
		// trash is written, so an active one is a `null` instead of being
		// restamped, and of two concurrent restores exactly one wins (S3).
		const { count } = await this.prisma.product.updateMany({
			where: { id: productId, companyId, deletedAt: { not: null } },
			data: { deletedAt: null, updatedAt: now },
		});

		if (count === 0) {
			return null;
		}

		const row = await this.prisma.product.findFirst({
			where: { id: productId, companyId },
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	async purge(
		companyId: string,
		productId: string,
	): Promise<PurgeProductResult> {
		let count: number;
		try {
			// `deleteMany` (not `delete`) because it accepts the extra `deletedAt`
			// predicate: the trash is the only entry point (L3), so the guard is
			// part of the DELETE and not a read before it.
			({ count } = await this.prisma.product.deleteMany({
				where: { id: productId, companyId, deletedAt: { not: null } },
			}));
		} catch (error) {
			// A movement landed between the count and this DELETE: the database's
			// `ON DELETE RESTRICT` rejects the row and the caller gets the same
			// conflict the count would have produced (L4), never a 500.
			if (isForeignKeyViolation(error)) {
				return "has_movements";
			}

			throw error;
		}

		if (count > 0) {
			return "purged";
		}

		// Nothing matched: re-read the row to tell an absent (or foreign) product
		// from an active one. The `companyId` stays in the WHERE clause, so a row
		// of another company is absent too.
		const row = await this.prisma.product.findFirst({
			where: { id: productId, companyId },
		});

		return row === null ? "not_found" : "not_deleted";
	}

	/** Maps a raw Prisma row back into the domain entity. */
	private toDomain(row: ProductModel): Product {
		return Product.create({
			id: row.id,
			companyId: row.companyId,
			name: row.name,
			description: row.description,
			sku: row.sku,
			price: priceFromRow(row.price),
			photoUrl: row.photoUrl,
			stockQuantity: row.stockQuantity,
			lowStockThreshold: row.lowStockThreshold,
			// Read back so the lot readings can name the measure of a `$/measure`
			// with the unit the product is bought in.
			measureUnit: row.measureUnit,
			categoryId: row.categoryId,
			deletedAt: row.deletedAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}
}
