import type { StockLot } from "../entities/stock-lot.js";

/**
 * Port for purchase lot persistence (S6).
 *
 * The slice needs exactly one write, and it is deliberately **one** method:
 * L7 fixes that the lot, its units, the `IN` movement that brings them in and
 * the stock increment are a single atomic operation. Three chained calls would
 * let the last one fail after the first two were persisted, leaving an orphan
 * lot or a stock that no longer matches its units.
 *
 * The write is described by the entity: it already carries the derived
 * `measureTotal`, the per-unit costs and the number of units, so no adapter
 * decides any of those numbers.
 *
 * There is no update nor delete: a lot is the trace of a purchase, the same way
 * a movement is the trace of a stock change.
 */
export interface StockLotRepository {
	/**
	 * Persists the lot, its units, the `IN` movement of `lot.unitCount` units
	 * linked to the lot, and the increment of the product's `stockQuantity`.
	 *
	 * `registeredByUserId` is the caller from the token: it is the one field of
	 * the movement that does not belong to the lot (a lot has no author column).
	 *
	 * Throws {@link ProductNotFoundError} when the product is no longer active
	 * in the lot's company at write time -- the use case read it a moment ago,
	 * so that is a row deleted or moved between the two. Nothing is persisted in
	 * that case: the caller sees the same `product_not_found` a missing id
	 * produces.
	 */
	register(lot: StockLot, registeredByUserId: string): Promise<StockLot>;
}
