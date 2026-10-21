import type { Product } from "../entities/product.js";

/**
 * Port for product persistence.
 *
 * Two things are part of the contract rather than an optimisation:
 *
 * - **Every query takes the `companyId` and filters by it in the WHERE
 *   clause** (isolation, EMP-03/S4). A read that resolved a row and compared
 *   the company afterwards would be a filter in memory, and the adapter could
 *   forget it.
 * - **`deletedAt` is a guard, never a post-filter.** A soft-deleted product is
 *   simply not there: `findActiveById`, `list` and both writes only ever see
 *   active rows, so "deleted" and "does not exist" are the same answer.
 *
 * The write surface is deliberately narrow: `stockQuantity`,
 * `lowStockThreshold`, `categoryId` and the soft-delete stamp are not settable
 * from the product endpoints (MI-8, MI-12, L4), so no method accepts them.
 */
export interface ProductRepository {
	/**
	 * Persists a product that already exists as an entity, so it reaches the
	 * database already validated and normalized.
	 *
	 * Throws {@link SkuAlreadyExistsError} when the company already has a
	 * product (deleted or not) with the same SKU. Both adapters enforce it: the
	 * Prisma one relies on the unique index and translates `P2002`, the
	 * in-memory one compares the rows itself, so neither can be the only place
	 * the invariant holds.
	 */
	create(product: Product): Promise<Product>;

	/** Resolves an active product of the company, or `null`. */
	findActiveById(companyId: string, productId: string): Promise<Product | null>;

	/**
	 * Resolves a product of the company by SKU **including the soft-deleted
	 * rows**, because a deleted product keeps its SKU reserved. It is the read
	 * the uniqueness check needs, not a catalogue lookup.
	 */
	findBySku(companyId: string, sku: string): Promise<Product | null>;

	/**
	 * Resolves the products of the company with the given ids in one batch
	 * read.
	 *
	 * It is a **history** read, which is why it differs from
	 * {@link findActiveById}: a stock movement of a soft-deleted product must
	 * stay readable (MOV-05), so the `deletedAt` filter is deliberately absent.
	 * The `companyId` stays in the WHERE clause, so a deleted product of
	 * another company never resolves. The result is not required to be
	 * complete or ordered -- an id with no row is simply absent -- so the
	 * caller joins in memory; for the movement history a missing product is an
	 * inconsistent store, never an invented row.
	 */
	findByIds(companyId: string, ids: string[]): Promise<Product[]>;

	/**
	 * Lists the company's active products, ordered by name and then id so two
	 * reads of the same state answer the same array.
	 *
	 * `search`, when present, is a case-insensitive substring matched against
	 * the name **or** the SKU (PROD-04/S5).
	 */
	list(companyId: string, search?: string): Promise<Product[]>;

	/**
	 * Writes the next state of an already-valid entity, guarded on
	 * `deletedAt: null`, and returns the stored row -- or `null` when nothing
	 * was updated (the product was soft-deleted or belongs to another company
	 * between the read and the write).
	 *
	 * Only the mutable fields are written; the server-owned ones are carried by
	 * the entity and left alone.
	 */
	update(product: Product): Promise<Product | null>;

	/**
	 * Soft-deletes an active product by stamping `deletedAt`, and returns the
	 * row -- or `null` when there was nothing to delete.
	 *
	 * Guarded on `deletedAt: null` so a second `DELETE` is a `null` instead of a
	 * second stamp that would reset the original date.
	 */
	softDelete(companyId: string, productId: string): Promise<Product | null>;
}
