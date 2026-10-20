import { Product } from "../../domain/entities/product.js";
import { DomainError } from "../../domain/errors/domain-error.js";
import { SkuAlreadyExistsError } from "../../domain/errors/sku-already-exists-error.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";
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

	async list(companyId: string, search?: string): Promise<Product[]> {
		const needle = search?.trim();

		const rows = await this.prisma.product.findMany({
			where: {
				companyId,
				deletedAt: null,
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
			categoryId: row.categoryId,
			deletedAt: row.deletedAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}
}
