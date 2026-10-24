import type { AvailableUnitTotals } from "../../domain/costing/derived-costs.js";
import {
	formatMeasure,
	formatMoney,
	type LotUnitStatus,
	measureFromText,
	moneyFromText,
} from "../../domain/entities/lot-unit.js";
import type { StockLot } from "../../domain/entities/stock-lot.js";
import { StockMovement } from "../../domain/entities/stock-movement.js";
import { DomainError } from "../../domain/errors/domain-error.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import type {
	ProductLotSummary,
	ProductUnitStatusFilter,
	ProductUnitSummary,
	StockLotRepository,
	SupplierLatestLot,
} from "../../domain/repositories/stock-lot-repository.js";
import type { InMemoryStockMovementRepository } from "./in-memory-stock-movement-repository.js";

/**
 * In-memory adapter for the {@link StockLotRepository} port.
 *
 * It composes the **existing** `StockMovementRepository` instead of applying
 * the stock delta itself: the increment and the movement insert are exactly the
 * rules that adapter already enforces (the product must be active in the
 * company, the movement is only recorded when the stock change landed), so
 * re-implementing them here would be a second copy to drift.
 *
 * L7 still holds in memory: the lot is stored, the movement repository applies
 * its write, and a failure removes the lot again before the error is rethrown.
 * Nothing is written after that call returns, so the state left behind is
 * exactly the one the movement repository produced.
 *
 * The units are handed to the **movement** repository once the entry landed:
 * they live in the one store the ledger reads, which is what lets a later sale
 * mark them `SOLD` and what the database shares through the `lot_units` table.
 * That is why this adapter is typed against the in-memory ledger and not only
 * against the port.
 */
export class InMemoryStockLotRepository implements StockLotRepository {
	private readonly lots: Map<string, StockLot>;
	private readonly stockMovements: InMemoryStockMovementRepository;

	constructor(
		stockMovements: InMemoryStockMovementRepository,
		lots: StockLot[] = [],
	) {
		this.stockMovements = stockMovements;
		this.lots = new Map<string, StockLot>();

		for (const lot of lots) {
			this.lots.set(lot.id, lot);
		}
	}

	async register(lot: StockLot, registeredByUserId: string): Promise<StockLot> {
		const movement = StockMovement.create({
			companyId: lot.companyId,
			productId: lot.productId,
			type: "IN",
			quantity: lot.unitCount,
			reason: lot.note,
			userId: registeredByUserId,
			lotId: lot.id,
			createdAt: lot.createdAt,
		});

		this.lots.set(lot.id, lot);

		const result = await this.stockMovements.register(movement);

		switch (result.kind) {
			case "product_not_found":
				// Same rollback the database performs when the guarded update
				// matches no row (L7).
				this.lots.delete(lot.id);
				throw new ProductNotFoundError();
			case "insufficient_stock":
				// Unreachable: an `IN` of a positive amount never runs out of
				// stock. Reported instead of silently keeping the lot.
				this.lots.delete(lot.id);
				throw new DomainError(
					"An entry movement can never exceed the available stock",
				);
			case "units_required":
			case "unit_not_available":
				// Unreachable: the entry a lot registers takes no units and writes no
				// price, so the sale rules can never fire for it. Reported instead of
				// silently keeping the lot.
				this.lots.delete(lot.id);
				throw new DomainError(
					"An entry movement can never be rejected by the sale unit rules",
				);
			case "registered":
				// The units join the store only once the entry landed, so a failed write
				// leaves no roll the ledger does not know about.
				this.stockMovements.saveUnits(
					lot.units.map((unit) => ({
						unit,
						companyId: lot.companyId,
						productId: lot.productId,
					})),
				);

				return lot;
		}
	}

	async findAvailableUnitTotals(
		companyId: string,
		productIds: string[],
	): Promise<Map<string, AvailableUnitTotals>> {
		const wanted = new Set(productIds);
		// The status of a unit lives in the ledger (production reads the shared
		// `lot_units` row), so the lot's own copy would keep saying AVAILABLE
		// after a sale. The ledger is the authority here too.
		const statuses = this.unitStatuses();
		const sums = new Map<
			string,
			{ unitCount: number; measureMilli: bigint; costCents: bigint }
		>();

		// The same filter the Prisma adapter puts in the WHERE clause: the
		// company, the products and the `AVAILABLE` status. A sold unit no
		// longer contributes to the cost of what is left.
		for (const lot of this.lots.values()) {
			if (lot.companyId !== companyId || !wanted.has(lot.productId)) {
				continue;
			}

			for (const unit of lot.units) {
				if ((statuses.get(unit.id) ?? unit.status) !== "AVAILABLE") {
					continue;
				}

				const availableMeasure = measureMilli(unit.measure);
				const availableCost = costCents(unit.cost);
				const current = sums.get(lot.productId) ?? {
					unitCount: 0,
					measureMilli: 0n,
					costCents: 0n,
				};

				sums.set(lot.productId, {
					unitCount: current.unitCount + 1,
					measureMilli: current.measureMilli + availableMeasure,
					costCents: current.costCents + availableCost,
				});
			}
		}

		const totals = new Map<string, AvailableUnitTotals>();
		for (const [productId, sum] of sums) {
			totals.set(productId, {
				unitCount: sum.unitCount,
				measureTotal: formatMeasure(sum.measureMilli),
				costTotal: formatMoney(sum.costCents),
			});
		}

		return totals;
	}

	async findLatestByProduct(
		companyId: string,
		productId: string,
		limit: number,
	): Promise<ProductLotSummary[]> {
		const statuses = this.unitStatuses();

		// Same WHERE and order as the Prisma adapter: the company and the
		// product, newest first, capped after the order so the cap keeps the
		// newest rows.
		return Array.from(this.lots.values())
			.filter(
				(lot) => lot.companyId === companyId && lot.productId === productId,
			)
			.sort(compareNewestFirst)
			.slice(0, limit)
			.map((lot) => ({
				id: lot.id,
				productId: lot.productId,
				supplierId: lot.supplierId,
				receivedAt: lot.receivedAt,
				measureTotal: lot.measureTotal,
				costPerMeasure: lot.costPerMeasure,
				unitCount: lot.unitCount,
				availableUnits: lot.units.filter(
					(unit) => (statuses.get(unit.id) ?? unit.status) === "AVAILABLE",
				).length,
			}));
	}

	async findLatestBySupplier(
		companyId: string,
		supplierIds: string[],
	): Promise<Map<string, SupplierLatestLot>> {
		const wanted = new Set(supplierIds);
		const latest = new Map<string, SupplierLatestLot>();

		// The order is the same one the product read uses, so "the most recent
		// lot" means the same thing in both readings.
		const rows = Array.from(this.lots.values())
			.filter(
				(lot) => lot.companyId === companyId && wanted.has(lot.supplierId),
			)
			.sort(compareNewestFirst);

		for (const lot of rows) {
			// The first row per supplier is its newest one.
			if (!latest.has(lot.supplierId)) {
				latest.set(lot.supplierId, {
					id: lot.id,
					productId: lot.productId,
					receivedAt: lot.receivedAt,
					costPerMeasure: lot.costPerMeasure,
				});
			}
		}

		return latest;
	}

	async findUnitsByProduct(
		companyId: string,
		productId: string,
		status: ProductUnitStatusFilter,
	): Promise<ProductUnitSummary[]> {
		// The status of a unit lives in the ledger (production reads the shared
		// `lot_units` row), so the lot's own copy would keep saying AVAILABLE after
		// a sale. The ledger is the authority here too, exactly like in the totals
		// and latest-lot reads.
		const statuses = this.unitStatuses();

		// The same filter and order as the Prisma adapter: the company and the
		// product, the requested status, the oldest lot first and then the code.
		const units: ProductUnitSummary[] = [];

		for (const lot of Array.from(this.lots.values())
			.filter(
				(candidate) =>
					candidate.companyId === companyId &&
					candidate.productId === productId,
			)
			.sort(compareOldestFirst)) {
			for (const unit of [...lot.units].sort((a, b) =>
				a.code.localeCompare(b.code),
			)) {
				const current = statuses.get(unit.id) ?? unit.status;

				if (status !== "ALL" && current !== status) {
					continue;
				}

				units.push({
					id: unit.id,
					lotId: lot.id,
					code: unit.code,
					measure: unit.measure,
					cost: unit.cost,
					status: current,
					receivedAt: lot.receivedAt,
				});
			}
		}

		return units;
	}

	/**
	 * The current status of every unit, by unit id, read from the ledger.
	 *
	 * The lot holds the units it brought in; the ledger holds their status,
	 * because that is the row a sale writes. Reading it here is what makes the
	 * in-memory adapter answer what the database would.
	 */
	private unitStatuses(): Map<string, LotUnitStatus> {
		return new Map(
			this.stockMovements.listUnits().map((unit) => [unit.id, unit.status]),
		);
	}

	/**
	 * Adapter-specific: the lots of one company, oldest first.
	 *
	 * It exists for the suites (the endpoint needs to prove that a rejected
	 * request left no lot row behind), the same way `save` exists on the other
	 * in-memory adapters. It is not part of the port: T5's reads are their own
	 * slice.
	 */
	listByCompany(companyId: string): StockLot[] {
		return Array.from(this.lots.values())
			.filter((lot) => lot.companyId === companyId)
			.sort(
				(a, b) =>
					a.createdAt.getTime() - b.createdAt.getTime() ||
					a.id.localeCompare(b.id),
			);
	}
}

/**
 * Newest first, with two tie-breaks so two reads of the same state answer the
 * same array: the business date (`receivedAt`), then the moment the row was
 * written, then the id.
 */
function compareNewestFirst(a: StockLot, b: StockLot): number {
	return (
		b.receivedAt.getTime() - a.receivedAt.getTime() ||
		b.createdAt.getTime() - a.createdAt.getTime() ||
		b.id.localeCompare(a.id)
	);
}

/**
 * The exact reverse of {@link compareNewestFirst}, so "the oldest lot first" is
 * the same order the latest-lot reads use, read backwards.
 */
function compareOldestFirst(a: StockLot, b: StockLot): number {
	return (
		a.receivedAt.getTime() - b.receivedAt.getTime() ||
		a.createdAt.getTime() - b.createdAt.getTime() ||
		a.id.localeCompare(b.id)
	);
}

/** Reads a normalized `Decimal(12,3)` measure of a unit, in thousandths. */
function measureMilli(raw: string): bigint {
	const value = measureFromText(raw);

	if (value === null) {
		throw new DomainError(`Unreadable lot unit measure: ${raw}`);
	}

	return value;
}

/** Reads a normalized `Decimal(12,2)` cost of a unit, in cents. */
function costCents(raw: string): bigint {
	const value = moneyFromText(raw);

	if (value === null) {
		throw new DomainError(`Unreadable lot unit cost: ${raw}`);
	}

	return value;
}
