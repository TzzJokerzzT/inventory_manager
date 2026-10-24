import type { LotUnit } from "../../domain/entities/lot-unit.js";
import type { Product } from "../../domain/entities/product.js";
import type {
	StockMovement,
	StockMovementUnit,
} from "../../domain/entities/stock-movement.js";
import type {
	RegisterMovementResult,
	StockMovementFilters,
	StockMovementRepository,
} from "../../domain/repositories/stock-movement-repository.js";

/**
 * A physical unit as the in-memory store holds it.
 *
 * The unit itself knows its lot but not whose lot it is, and the sale has to
 * answer "is this unit of *this* product of *this* company?" in one lookup, so
 * the owner travels next to the row. It is adapter-specific: production reads it
 * through the `lot` relation.
 */
export interface InMemoryLotUnitRecord {
	unit: LotUnit;
	companyId: string;
	productId: string;
}

/**
 * In-memory adapter for the {@link StockMovementRepository} port.
 *
 * It mirrors the Prisma adapter's rules, **in the same order**: the product must
 * be active and belong to the movement's company, a sale of a product with
 * available units must name them and their price (L9), an exit can never take
 * the stock below zero, and every named unit must still be `AVAILABLE` for this
 * product of this company. A movement is only recorded when all of that holds.
 *
 * The store needs no transaction, because there is no `await` between reading
 * the state and writing it back -- nothing else can interleave -- so every rule
 * is checked **before** the first write and a rejected sale leaves the stock,
 * the units and the ledger exactly as they were.
 *
 * The constructor takes the **same** `Map` the `InMemoryProductRepository`
 * serves. That is adapter-specific and exists so the ledger and the product
 * reads share one state; production wires the Prisma adapters, where the
 * database is that shared state.
 */
export class InMemoryStockMovementRepository
	implements StockMovementRepository
{
	private readonly products: Map<string, Product>;
	private readonly movements = new Map<string, StockMovement>();
	/** movementId -> the unit ids it took. */
	private readonly movementUnits = new Map<string, string[]>();
	private readonly units = new Map<string, InMemoryLotUnitRecord>();

	constructor(products: Map<string, Product>, movements: StockMovement[] = []) {
		this.products = products;

		for (const movement of movements) {
			this.movements.set(movement.id, movement);
		}
	}

	async register(movement: StockMovement): Promise<RegisterMovementResult> {
		const product = this.products.get(movement.productId);

		// Same WHERE clause as the Prisma adapter's guarded update: the id, the
		// company and `deletedAt: null`, so a foreign or soft-deleted product
		// answers `product_not_found` and never moves its stock.
		if (
			product === undefined ||
			product.companyId !== movement.companyId ||
			product.deletedAt !== null
		) {
			return { kind: "product_not_found" };
		}

		// L9: only a **sale** of a product that has units available is required to
		// name them. The same predicate the Prisma adapter counts with: `AVAILABLE`
		// units of this product, inside this company. An entry is untouched by the
		// rule, so adding stock the old way keeps working.
		const availableUnits =
			movement.type === "OUT"
				? this.availableUnitsOf(movement.companyId, movement.productId)
				: [];

		if (
			availableUnits.length > 0 &&
			(movement.unitPrice === null ||
				movement.unitIds.length === 0 ||
				movement.unitIds.length !== movement.quantity)
		) {
			return { kind: "units_required" };
		}

		const delta =
			movement.type === "IN" ? movement.quantity : -movement.quantity;
		const stockQuantity = product.stockQuantity + delta;

		// The guard the database applies with `stockQuantity >= quantity`: if it
		// does not hold, nothing is written and the caller learns what is
		// available.
		if (stockQuantity < 0) {
			return { kind: "insufficient_stock", available: product.stockQuantity };
		}

		// Every named unit has to be one of the available ones. A unit of another
		// product, of another company or already sold is the same answer, which is
		// what keeps the rejection from confirming somebody else's rows.
		const taken: InMemoryLotUnitRecord[] = [];
		for (const unitId of movement.unitIds) {
			const record = this.units.get(unitId);

			if (
				record === undefined ||
				record.companyId !== movement.companyId ||
				record.productId !== movement.productId ||
				record.unit.status !== "AVAILABLE"
			) {
				return { kind: "unit_not_available" };
			}

			taken.push(record);
		}

		// The entity is immutable, so the stock change builds the next state and
		// replaces the row under the same id. Nothing is written before every
		// rule above held: a rejected sale leaves no unit marked and no stock
		// moved.
		this.products.set(product.id, product.withStock(stockQuantity));
		for (const record of taken) {
			this.units.set(record.unit.id, {
				...record,
				unit: record.unit.withStatus("SOLD"),
			});
		}
		this.movements.set(movement.id, movement);
		if (movement.unitIds.length > 0) {
			this.movementUnits.set(movement.id, [...movement.unitIds]);
		}

		return {
			kind: "registered",
			movement,
			stockQuantity,
			units: taken.map((record) => toStockMovementUnit(record.unit)),
		};
	}

	async findByCompany(
		companyId: string,
		filters: StockMovementFilters,
	): Promise<StockMovement[]> {
		// Same scoping and order as the Prisma adapter's query: the company is
		// part of the filter, newest first, and the limit is applied after the
		// order so it keeps the newest rows. The customer filter mirrors the
		// WHERE clause too: an anonymous movement never matches a customer id.
		return Array.from(this.movements.values())
			.filter((movement) => movement.companyId === companyId)
			.filter(
				(movement) =>
					filters.productId === undefined ||
					movement.productId === filters.productId,
			)
			.filter(
				(movement) =>
					filters.customerId === undefined ||
					movement.customerId === filters.customerId,
			)
			.filter(
				(movement) =>
					filters.type === undefined || movement.type === filters.type,
			)
			.sort(
				(a, b) =>
					b.createdAt.getTime() - a.createdAt.getTime() ||
					b.id.localeCompare(a.id),
			)
			.slice(0, filters.limit);
	}

	async findSince(companyId: string, since: Date): Promise<StockMovement[]> {
		// Same WHERE and order as the Prisma adapter's range read: the company is
		// part of the filter and the boundary is inclusive (`createdAt >= since`),
		// oldest first with the id as the tie-break.
		return Array.from(this.movements.values())
			.filter((movement) => movement.companyId === companyId)
			.filter((movement) => movement.createdAt.getTime() >= since.getTime())
			.sort(
				(a, b) =>
					a.createdAt.getTime() - b.createdAt.getTime() ||
					a.id.localeCompare(b.id),
			);
	}

	async countByProduct(companyId: string, productId: string): Promise<number> {
		// Same predicates as the Prisma adapter's `count`: the company and the
		// product, so a movement of another company never blocks a purge.
		return Array.from(this.movements.values()).filter(
			(movement) =>
				movement.companyId === companyId && movement.productId === productId,
		).length;
	}

	async findUnitsByMovementIds(
		companyId: string,
		movementIds: string[],
	): Promise<Map<string, StockMovementUnit[]>> {
		const unitsByMovement = new Map<string, StockMovementUnit[]>();

		for (const movementId of movementIds) {
			const movement = this.movements.get(movementId);

			// Same scoping as the Prisma adapter's WHERE: a movement of another
			// company resolves to nothing, and one without links is simply absent.
			if (movement === undefined || movement.companyId !== companyId) {
				continue;
			}

			const unitIds = this.movementUnits.get(movementId) ?? [];
			if (unitIds.length === 0) {
				continue;
			}

			unitsByMovement.set(
				movementId,
				unitIds
					.flatMap((unitId) => {
						const record = this.units.get(unitId);

						return record === undefined ? [] : [record.unit];
					})
					.sort(
						(a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id),
					)
					.map(toStockMovementUnit),
			);
		}

		return unitsByMovement;
	}

	/** Adapter-specific: lets the test suite insert movements directly. */
	save(movement: StockMovement): void {
		this.movements.set(movement.id, movement);
	}

	/**
	 * Adapter-specific: the units a purchase lot brought in.
	 *
	 * The lot repository calls this after its `IN` landed, so the ledger and the
	 * units share one state exactly like the database shares it. It is not part
	 * of the port.
	 */
	saveUnits(records: InMemoryLotUnitRecord[]): void {
		for (const record of records) {
			this.units.set(record.unit.id, record);
		}
	}

	/** Adapter-specific: the units the store knows, for the suites to read back. */
	listUnits(): LotUnit[] {
		return Array.from(this.units.values()).map((record) => record.unit);
	}

	/** The `AVAILABLE` units of one product of one company. */
	private availableUnitsOf(
		companyId: string,
		productId: string,
	): InMemoryLotUnitRecord[] {
		return Array.from(this.units.values()).filter(
			(record) =>
				record.companyId === companyId &&
				record.productId === productId &&
				record.unit.status === "AVAILABLE",
		);
	}
}

/** The unit as the readings expose it: no lot, no status, no timestamps. */
function toStockMovementUnit(unit: LotUnit): StockMovementUnit {
	return {
		id: unit.id,
		code: unit.code,
		measure: unit.measure,
		cost: unit.cost,
	};
}
