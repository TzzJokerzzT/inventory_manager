import type { Supplier } from "../entities/supplier.js";

/**
 * Port for supplier persistence (S4: the supplier is an entity with ABM).
 *
 * Two things are part of the contract rather than an optimisation:
 *
 * - **Every query takes the `companyId` and filters by it in the WHERE
 *   clause** (isolation, EMP-03). A read that resolved a row and compared the
 *   company afterwards would be a filter in memory, and the adapter could
 *   forget it.
 * - **`deletedAt` is a guard, never a post-filter.** A soft-deleted supplier is
 *   simply not there: `findById`, `listByCompany` and both writes only ever
 *   match active rows, so "deleted" and "does not exist" are the same answer.
 *
 * The name uniqueness is the third rule, and it belongs to the adapters because
 * it needs the store: `create` and `update` throw
 * {@link SupplierNameAlreadyExistsError} when the company already has a
 * supplier -- deleted or not, since the `@@unique([companyId, name])` index
 * covers the deleted rows too -- with the same name. There is no `findByName`
 * read here on purpose: the check has exactly one consumer (the write itself)
 * and the index is the authority for two concurrent writes, so a separate read
 * would be a second place for the rule to drift.
 *
 * There is no `purge` either: S4 asks for a *baja lógica*, and a supplier is
 * referenced by the purchase lots, so the row must stay for the lots to keep
 * pointing at it.
 */
export interface SupplierRepository {
	/**
	 * Persists a supplier that already exists as an entity, so it reaches the
	 * database already validated and normalized (trimmed name, blank contact as
	 * `null`).
	 *
	 * Throws {@link SupplierNameAlreadyExistsError} when the company already has
	 * a supplier with the same name (see the port doc).
	 */
	create(supplier: Supplier): Promise<Supplier>;

	/** Resolves an active supplier of the company, or `null`. */
	findById(companyId: string, supplierId: string): Promise<Supplier | null>;

	/**
	 * Resolves the suppliers of the company with the given ids in one batch
	 * read, **including the soft-deleted rows**.
	 *
	 * It is the read a history needs, not a roster lookup: a lot of a supplier
	 * that was soft-deleted afterwards must still show whose lot it was, the
	 * same way a movement of a deleted product stays readable. The `companyId`
	 * stays in the WHERE clause, so another company's supplier never resolves,
	 * and an id with no row is simply absent from the answer for the caller to
	 * join in memory.
	 */
	findByIds(companyId: string, ids: string[]): Promise<Supplier[]>;

	/**
	 * Lists the company's active suppliers, ordered by name and then id so two
	 * reads of the same state answer the same array.
	 *
	 * There is no page or search argument: the roster of suppliers of a company
	 * is small enough to read whole, and a filter with no contract behind it
	 * would be a surface to maintain for nobody.
	 */
	listByCompany(companyId: string): Promise<Supplier[]>;

	/**
	 * Writes the next state of an already-valid entity, guarded on
	 * `deletedAt: null`, and returns the stored row -- or `null` when nothing
	 * was updated (the supplier was soft-deleted or belongs to another company
	 * between the read and the write).
	 *
	 * Throws {@link SupplierNameAlreadyExistsError} when the new name belongs to
	 * another supplier of the company, deleted rows included.
	 */
	update(supplier: Supplier): Promise<Supplier | null>;

	/**
	 * Soft-deletes an active supplier by stamping `deletedAt`, and returns the
	 * row -- or `null` when there was nothing to delete.
	 *
	 * The stamp is a parameter so both adapters store the exact instant the use
	 * case decided on, instead of each adapter inventing its own clock.
	 *
	 * Guarded on `deletedAt: null` so a second `DELETE` is a `null` instead of a
	 * second stamp that would reset the original date.
	 */
	softDelete(
		companyId: string,
		supplierId: string,
		deletedAt: Date,
	): Promise<Supplier | null>;
}
