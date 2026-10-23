import type {
	StockMovement,
	StockMovementType,
} from "../entities/stock-movement.js";

// Re-exported from the entity on purpose: the union belongs to the domain
// model, and consumers of the port should not have to reach past it.
export type { StockMovementType };

/**
 * The outcome of `register`.
 *
 * It is a discriminated union instead of exceptions because two of its three
 * cases are *expected* outcomes of the guarded write, not failures: the
 * product is not in the company's active catalogue, or the exit asked for more
 * than the stock. The use case maps each case to its domain error, so no
 * adapter decides an HTTP status.
 */
export type RegisterMovementResult =
	| { kind: "registered"; movement: StockMovement; stockQuantity: number }
	| { kind: "product_not_found" }
	| { kind: "insufficient_stock"; available: number };

export interface StockMovementFilters {
	productId?: string;
	/**
	 * Only the movements of this customer: the sales of one customer, combined
	 * with `type=OUT` when the caller wants nothing but exits. It is a read
	 * filter, so an id of another company matches no row instead of failing.
	 */
	customerId?: string;
	type?: StockMovementType;
	limit: number;
}

/**
 * Port for stock movement persistence.
 *
 * - **`register` is atomic**: applying the stock delta and inserting the
 *   movement happen in one transaction (MOV-04). A movement that is not
 *   recorded must not move the stock, and a stock change that cannot be
 *   applied must not leave a movement behind.
 * - **The stock never goes negative**: an `OUT` is applied by a guarded write
 *   (`stockQuantity >= quantity`), so two concurrent exits cannot both win;
 *   the loser answers `insufficient_stock` with the stock available.
 * - **The history is company-scoped and read-only**: there is no update nor
 *   delete method, because a movement is the audit trail of the stock
 *   (MOV-05).
 */
export interface StockMovementRepository {
	/**
	 * Applies the movement's stock delta and inserts the movement in one
	 * transaction, returning the product's stock **after** the change.
	 */
	register(movement: StockMovement): Promise<RegisterMovementResult>;

	/**
	 * Reads the company's movements, newest first.
	 *
	 * `productId` and `type` narrow the history (MOV-03) and `limit` caps it,
	 * so the list endpoint answers in a bounded read instead of loading the
	 * whole trail. `customerId` narrows it to the sales of one customer; it is
	 * applied in the WHERE next to `companyId`, so a customer of another
	 * company simply matches no row (it is not a resource to answer 404 for).
	 */
	findByCompany(
		companyId: string,
		filters: StockMovementFilters,
	): Promise<StockMovement[]>;

	/**
	 * Reads every movement of the company created at or after `since`, oldest
	 * first.
	 *
	 * It is the **range read for aggregation**: the dashboard's trend report
	 * needs all the movements of a window, not one bounded page of them, so the
	 * range lives in the WHERE (`companyId` + `createdAt >= since`) and the
	 * caller aggregates the rows. Like every other read it is company-scoped, so
	 * a company never sees another company's trail; the order is ascending with
	 * the id as the tie-break, so two reads of the same state answer the same
	 * array.
	 */
	findSince(companyId: string, since: Date): Promise<StockMovement[]>;

	/**
	 * Counts the company's movements of one product.
	 *
	 * It is the read the permanent delete needs (odd/tasks/product-purge.md L4):
	 * the count answers a readable conflict without attempting a delete that
	 * the database would reject anyway. The `companyId` is part of the count, so
	 * a movement of another company never blocks a purge, and it is a read of
	 * the ledger -- the ledger itself is never written by a purge (MOV-05).
	 */
	countByProduct(companyId: string, productId: string): Promise<number>;
}
