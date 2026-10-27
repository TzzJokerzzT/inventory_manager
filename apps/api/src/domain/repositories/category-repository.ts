import type { Category } from "../entities/category.js";

/**
 * The outcome of {@link CategoryRepository.delete}.
 *
 * It is a discriminated union for the same reason `PurgeProductResult` is:
 * `not_found` and `in_use` are *expected* answers of a guarded delete, not
 * failures. The use case maps each one to its domain error, so no adapter
 * decides an HTTP status.
 *
 * `in_use` is the race S4 describes: a product started pointing at the category
 * between the count and the `DELETE`, so the database's `ON DELETE RESTRICT`
 * rejected the row. The in-memory adapter can only observe it if its product
 * store says so, which is why it re-checks before removing the row.
 */
export type DeleteCategoryResult = "deleted" | "not_found" | "in_use";

/**
 * Port for category persistence (S3, S4).
 *
 * Two things are part of the contract rather than an optimisation:
 *
 * - **Every query takes the `companyId` and filters by it in the WHERE
 *   clause** (isolation, S4). A read that resolved a row and compared the
 *   company afterwards would be a filter in memory, and the adapter could
 *   forget it.
 * - **There is no soft delete.** A category is not audit history, so the row is
 *   removed for good and "does not exist" and "was deleted" are the same
 *   answer. That is why no method here takes or returns a `deletedAt` stamp.
 *
 * The name uniqueness is the second rule, and it belongs to the adapters because
 * it needs the store: `create` and `update` throw
 * {@link CategoryNameAlreadyExistsError} when the company already has a category
 * with the same name. The comparison is **case-sensitive**, exactly like the
 * `@@unique([companyId, name])` index. There is no `findByName` read here on
 * purpose: the check has exactly one consumer (the write itself) and the index
 * is the authority for two concurrent writes, so a separate read would be a
 * second place for the rule to drift.
 */
export interface CategoryRepository {
	/**
	 * Persists a category that already exists as an entity, so it reaches the
	 * database already validated and normalized (trimmed name).
	 *
	 * Throws {@link CategoryNameAlreadyExistsError} when the company already has
	 * a category with the same name (see the port doc).
	 */
	create(category: Category): Promise<Category>;

	/** Resolves a category of the company, or `null`. */
	findById(companyId: string, categoryId: string): Promise<Category | null>;

	/**
	 * Resolves the categories of the company with the given ids in **one batch
	 * read**.
	 *
	 * It exists for the product reads (S5/S7): the list and the detail resolve
	 * `categoryName` for a whole page with one query instead of joining the
	 * catalogue per row. The `companyId` stays in the WHERE clause, so an id of
	 * another company never resolves, and the result is not required to be
	 * complete or ordered -- an id with no row is simply absent -- so the caller
	 * joins in memory.
	 */
	findByIds(companyId: string, ids: string[]): Promise<Category[]>;

	/**
	 * Lists the company's categories, ordered by name and then id so two reads
	 * of the same state answer the same array.
	 *
	 * There is no page or search argument: the catalogue of categories of a
	 * company is small enough to read whole, and a filter with no contract
	 * behind it would be a surface to maintain for nobody.
	 */
	listByCompany(companyId: string): Promise<Category[]>;

	/**
	 * Writes the next state of an already-valid entity, guarded on the company,
	 * and returns the stored row -- or `null` when nothing was updated (the
	 * category was deleted or belongs to another company between the read and
	 * the write).
	 *
	 * Throws {@link CategoryNameAlreadyExistsError} when the new name belongs to
	 * another category of the company.
	 */
	update(category: Category): Promise<Category | null>;

	/**
	 * Counts the products of the company that reference this category
	 * **including the soft-deleted ones**: the `Product.categoryId` foreign key
	 * is `RESTRICT` for every row, so a soft-deleted product blocks the delete
	 * exactly like an active one.
	 *
	 * It is the read the delete guard needs, not a product listing: the caller
	 * only has to know whether the answer is zero, and the number is carried into
	 * the error message so the client can explain the block.
	 */
	countProducts(companyId: string, categoryId: string): Promise<number>;

	/**
	 * Removes the row for good, but only while it belongs to the company and no
	 * product references it.
	 *
	 * `not_found` covers the absent and the foreign category with the same
	 * answer. `in_use` is the race: the database's `ON DELETE RESTRICT` reports
	 * it as a foreign-key violation (`P2003`), which the adapter translates so
	 * the caller gets the same conflict the count would have produced, never a
	 * 500.
	 */
	delete(companyId: string, categoryId: string): Promise<DeleteCategoryResult>;
}
