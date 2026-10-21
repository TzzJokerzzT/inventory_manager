import type { Product } from "../../domain/entities/product.js";
import type { StockMovement } from "../../domain/entities/stock-movement.js";
import type {
	RegisterMovementResult,
	StockMovementFilters,
	StockMovementRepository,
} from "../../domain/repositories/stock-movement-repository.js";

/**
 * In-memory adapter for the {@link StockMovementRepository} port.
 *
 * It mirrors the Prisma adapter's rules: the product must be active and belong
 * to the movement's company, an exit can never take the stock below zero, and
 * a movement is only recorded when the stock change actually landed. The
 * in-memory store needs no transaction, because there is no `await` between
 * reading the product and writing it back -- nothing else can interleave.
 *
 * The constructor takes the **same** `Map` the
 * `InMemoryProductRepository` serves. That is adapter-specific and exists so
 * the ledger and the product reads share one state; production wires the
 * Prisma adapters, where the database is that shared state.
 */
export class InMemoryStockMovementRepository
	implements StockMovementRepository
{
	private readonly products: Map<string, Product>;
	private readonly movements = new Map<string, StockMovement>();

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

		const delta =
			movement.type === "IN" ? movement.quantity : -movement.quantity;
		const stockQuantity = product.stockQuantity + delta;

		// The guard the database applies with `stockQuantity >= quantity`: if it
		// does not hold, nothing is written and the caller learns what is
		// available.
		if (stockQuantity < 0) {
			return { kind: "insufficient_stock", available: product.stockQuantity };
		}

		// The entity is immutable, so the stock change builds the next state and
		// replaces the row under the same id.
		this.products.set(product.id, product.withStock(stockQuantity));
		this.movements.set(movement.id, movement);

		return { kind: "registered", movement, stockQuantity };
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

	/** Adapter-specific: lets the test suite insert movements directly. */
	save(movement: StockMovement): void {
		this.movements.set(movement.id, movement);
	}
}
