import type { StockLot } from "../../domain/entities/stock-lot.js";
import { StockMovement } from "../../domain/entities/stock-movement.js";
import { DomainError } from "../../domain/errors/domain-error.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import type { StockLotRepository } from "../../domain/repositories/stock-lot-repository.js";
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
