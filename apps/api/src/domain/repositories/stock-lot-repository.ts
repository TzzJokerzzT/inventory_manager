import type { AvailableUnitTotals } from "../costing/derived-costs.js";
import type { StockLot } from "../entities/stock-lot.js";

/**
 * One purchase lot as the reads that compare suppliers summarize it (L12).
 *
 * It is the lot row plus what the store can answer about its units in one
 * query: `availableUnits` is how many of them are still `AVAILABLE`, so the
 * reader never loads the units themselves to count them.
 */
export interface ProductLotSummary {
	id: string;
	productId: string;
	supplierId: string;
	receivedAt: Date;
	/** `Decimal(12,3)` string: the sum of the units' measures (L6). */
	measureTotal: string;
	/** `Decimal(12,2)` string: the price of one measure. */
	costPerMeasure: string;
	unitCount: number;
	/** How many units of this lot are still `AVAILABLE`. */
	availableUnits: number;
}

/**
 * The most recent purchase of one supplier, as the roster summarizes it (L12).
 *
 * It carries exactly what the "which supplier should I buy from" row needs:
 * the product it was, its `$/measure` and when it arrived. The product's name
 * and measure unit are resolved by the reader, because they belong to the
 * catalogue row and not to the lot.
 */
export interface SupplierLatestLot {
	id: string;
	productId: string;
	receivedAt: Date;
	/** `Decimal(12,2)` string: the price of one measure. */
	costPerMeasure: string;
}

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

	/**
	 * Sums the `AVAILABLE` units of the given products of the company, keyed by
	 * product id.
	 *
	 * It is the read behind the derived costs of L12: the cost per measure and
	 * per unit are `Σ cost / Σ measure` and `Σ cost / count`, computed from the
	 * units that are still in stock -- never from a stored number that could
	 * desynchronize from them. A product whose units are all sold simply does
	 * not appear in the answer, which is what makes those costs `null` instead
	 * of `0`.
	 *
	 * The company is part of the query, like every other read, so ids of
	 * another company resolve to nothing. The sums travel as decimal strings
	 * because a sum can be wider than the column it comes from.
	 */
	findAvailableUnitTotals(
		companyId: string,
		productIds: string[],
	): Promise<Map<string, AvailableUnitTotals>>;

	/**
	 * Reads the latest `limit` lots of one product, newest first, with the
	 * number of units each still has available.
	 *
	 * "Newest" is `receivedAt`, then `createdAt`, then the id, so two reads of
	 * the same state answer the same array. The `companyId` and the product are
	 * both part of the query, so another company's lots never resolve.
	 */
	findLatestByProduct(
		companyId: string,
		productId: string,
		limit: number,
	): Promise<ProductLotSummary[]>;

	/**
	 * Reads the most recent lot of each of the given suppliers, keyed by
	 * supplier id, so the roster answers with one query instead of one per row.
	 *
	 * A supplier with no lot of the company simply does not appear in the
	 * answer. The `companyId` is part of the query, so another company's lots
	 * never resolve even when the supplier id was guessed.
	 */
	findLatestBySupplier(
		companyId: string,
		supplierIds: string[],
	): Promise<Map<string, SupplierLatestLot>>;
}
