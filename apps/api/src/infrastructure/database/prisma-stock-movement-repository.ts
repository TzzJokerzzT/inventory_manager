import {
	formatMeasure,
	formatMoney,
	measureFromText,
	moneyFromText,
} from "../../domain/entities/lot-unit.js";
import {
	StockMovement,
	type StockMovementUnit,
} from "../../domain/entities/stock-movement.js";
import type {
	RegisterMovementResult,
	StockMovementFilters,
	StockMovementRepository,
} from "../../domain/repositories/stock-movement-repository.js";
import type {
	Prisma,
	PrismaClient,
	StockMovement as StockMovementModel,
} from "./generated/prisma/client.js";

/**
 * The adapter depends on the `product`, `stockMovement`, `lotUnit` and
 * `movementUnit` delegates plus the interactive `$transaction`. The type-only
 * import is on purpose: the generated client is ESM-first and Jest runs through
 * `@swc/jest` in CommonJS, so a runtime import would break the suite.
 */
type StockMovementDelegate = Pick<
	PrismaClient,
	"product" | "stockMovement" | "lotUnit" | "movementUnit" | "$transaction"
>;

export interface PrismaStockMovementRepositoryDependencies {
	prisma: StockMovementDelegate;
}

/**
 * Signalled from inside the transaction when the guarded unit write matched
 * fewer rows than the sale named: a unit was sold between the count and the
 * write, or never belonged to this product. It is thrown instead of returned
 * because the stock has already been decremented at that point -- only a
 * rollback keeps "no unit marked and no stock moved" true (MOV-04).
 */
class UnitsTakenError extends Error {}

/**
 * Prisma-backed adapter for the {@link StockMovementRepository} port.
 *
 * `register` is the atomic write MOV-04 asks for, and it is built around
 * **guarded** writes instead of read-then-write:
 *
 * 1. It counts the `AVAILABLE` units of the product inside the company. Only a
 *    product that has them is required to name them and to carry the price
 *    (L9); the count is read in the same transaction that writes the sale, so
 *    the rule cannot be stale (L10).
 * 2. `updateMany` applies the delta with `where: { id, companyId, deletedAt:
 *    null }` and, for an exit, `stockQuantity: { gte: quantity }`. PostgreSQL
 *    locks the row for the update, so two concurrent exits cannot both pass the
 *    guard: the loser matches no row and the stock can never go negative.
 * 3. `count === 0` means the guard did not hold. A re-read inside the same
 *    transaction tells the two cases apart: no active product is
 *    `product_not_found`, still present is `insufficient_stock` with its stock.
 * 4. The named units are marked `SOLD` with `status: AVAILABLE` **in the
 *    WHERE**, so the same roll cannot be sold twice; too few rows updated means
 *    somebody else took one, the transaction is rolled back and the answer is
 *    `unit_not_available`.
 * 5. Only when every write landed are the movement and its `movement_units`
 *    links inserted, so a movement never claims a stock change or a unit that
 *    did not happen. The same transaction re-reads the product to answer with
 *    the stock after the change.
 *
 * Rows are always mapped back into the domain entity; a raw Prisma object never
 * crosses the port boundary.
 */
export class PrismaStockMovementRepository implements StockMovementRepository {
	private readonly prisma: StockMovementDelegate;

	constructor(dependencies: PrismaStockMovementRepositoryDependencies) {
		this.prisma = dependencies.prisma;
	}

	async register(movement: StockMovement): Promise<RegisterMovementResult> {
		const delta =
			movement.type === "IN" ? movement.quantity : -movement.quantity;

		try {
			return await this.prisma.$transaction(
				async (transaction): Promise<RegisterMovementResult> => {
					// L9: the rule is about **sales**. Only an exit is required to name
					// its units and carry the price; an entry keeps adding stock the old
					// way, so the count is only read for an exit.
					const availableUnits =
						movement.type === "OUT"
							? await transaction.lotUnit.count({
									where: {
										status: "AVAILABLE",
										lot: {
											companyId: movement.companyId,
											productId: movement.productId,
										},
									},
								})
							: 0;

					if (
						availableUnits > 0 &&
						(movement.unitPrice === null ||
							movement.unitIds.length === 0 ||
							movement.unitIds.length !== movement.quantity)
					) {
						// Nothing has been written yet, so returning is the whole rollback.
						return { kind: "units_required" };
					}

					const { count } = await transaction.product.updateMany({
						where: {
							id: movement.productId,
							companyId: movement.companyId,
							deletedAt: null,
							...(delta < 0 ? { stockQuantity: { gte: -delta } } : {}),
						},
						data: { stockQuantity: { increment: delta } },
					});

					if (count === 0) {
						const product = await transaction.product.findFirst({
							where: {
								id: movement.productId,
								companyId: movement.companyId,
								deletedAt: null,
							},
						});

						if (product === null) {
							return { kind: "product_not_found" };
						}

						return {
							kind: "insufficient_stock",
							available: product.stockQuantity,
						};
					}

					const units = await this.takeUnits(movement, transaction);

					const row = await transaction.stockMovement.create({
						data: {
							id: movement.id,
							companyId: movement.companyId,
							productId: movement.productId,
							type: movement.type,
							quantity: movement.quantity,
							reason: movement.reason,
							userId: movement.userId,
							customerId: movement.customerId,
							unitPrice: movement.unitPrice,
							lotId: movement.lotId,
							createdAt: movement.createdAt,
						},
					});

					if (units.length > 0) {
						await transaction.movementUnit.createMany({
							data: units.map((unit) => ({
								movementId: movement.id,
								lotUnitId: unit.id,
							})),
						});
					}

					const product = await transaction.product.findFirst({
						where: {
							id: movement.productId,
							companyId: movement.companyId,
							deletedAt: null,
						},
					});

					// The update just landed, so a missing row means the store is
					// inconsistent. Throwing rolls the transaction back instead of
					// recording a movement whose stock nobody can read back.
					if (product === null) {
						throw new Error(
							`Product ${movement.productId} disappeared between the stock update and the re-read`,
						);
					}

					return {
						kind: "registered",
						movement: this.toDomain(row),
						stockQuantity: product.stockQuantity,
						units,
					};
				},
			);
		} catch (error) {
			if (error instanceof UnitsTakenError) {
				return { kind: "unit_not_available" };
			}

			throw error;
		}
	}

	async findByCompany(
		companyId: string,
		filters: StockMovementFilters,
	): Promise<StockMovement[]> {
		const rows = await this.prisma.stockMovement.findMany({
			where: {
				companyId,
				...(filters.productId === undefined
					? {}
					: { productId: filters.productId }),
				// The customer is a filter inside the company's WHERE, never a
				// lookup: an id of another company matches no row.
				...(filters.customerId === undefined
					? {}
					: { customerId: filters.customerId }),
				...(filters.type === undefined ? {} : { type: filters.type }),
			},
			// Newest first, with the id as the tie-break, so two reads of the same
			// state answer the same array and the limit keeps the newest rows.
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: filters.limit,
		});

		return rows.map((row) => this.toDomain(row));
	}

	async findSince(companyId: string, since: Date): Promise<StockMovement[]> {
		const rows = await this.prisma.stockMovement.findMany({
			// The whole range lives in the WHERE, scoped by the company: it is a
			// range read for the trend report, not a page of the history.
			where: { companyId, createdAt: { gte: since } },
			// Oldest first, with the id as the tie-break, so the aggregate of two
			// reads of the same state cannot differ.
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		});

		return rows.map((row) => this.toDomain(row));
	}

	async countByProduct(companyId: string, productId: string): Promise<number> {
		// The company is part of the count, so a movement of another company can
		// never block a purge (odd/tasks/product-purge.md L4).
		return this.prisma.stockMovement.count({
			where: { companyId, productId },
		});
	}

	async findUnitsByMovementIds(
		companyId: string,
		movementIds: string[],
	): Promise<Map<string, StockMovementUnit[]>> {
		const unitsByMovement = new Map<string, StockMovementUnit[]>();

		if (movementIds.length === 0) {
			return unitsByMovement;
		}

		const rows = await this.prisma.movementUnit.findMany({
			// The company is part of the WHERE next to the ids, so a movement of
			// another company resolves to nothing even when its id was guessed.
			where: {
				movementId: { in: movementIds },
				movement: { companyId },
			},
			select: {
				movementId: true,
				lotUnit: {
					select: { id: true, code: true, measure: true, cost: true },
				},
			},
		});

		// The order is by code and then by id, so two reads of the same state
		// answer the same array instead of whatever order the table returned.
		const ordered = [...rows].sort(
			(a, b) =>
				a.lotUnit.code.localeCompare(b.lotUnit.code) ||
				a.lotUnit.id.localeCompare(b.lotUnit.id),
		);

		for (const row of ordered) {
			const units = unitsByMovement.get(row.movementId) ?? [];
			units.push({
				id: row.lotUnit.id,
				code: row.lotUnit.code,
				measure: measureText(row.lotUnit.measure),
				cost: moneyText(row.lotUnit.cost),
			});
			unitsByMovement.set(row.movementId, units);
		}

		return unitsByMovement;
	}

	/**
	 * Marks the units the sale named `SOLD` and returns them.
	 *
	 * The `status: "AVAILABLE"` in the WHERE is the guard: a unit that was sold
	 * in the meantime, or that belongs to another product or company, matches no
	 * row. Too few rows updated aborts the transaction, which is what keeps the
	 * stock decrement and any partial mark from surviving.
	 */
	private async takeUnits(
		movement: StockMovement,
		transaction: Prisma.TransactionClient,
	): Promise<StockMovementUnit[]> {
		if (movement.unitIds.length === 0) {
			return [];
		}

		const { count } = await transaction.lotUnit.updateMany({
			where: {
				id: { in: [...movement.unitIds] },
				status: "AVAILABLE",
				lot: {
					companyId: movement.companyId,
					productId: movement.productId,
				},
			},
			data: { status: "SOLD" },
		});

		if (count !== movement.unitIds.length) {
			throw new UnitsTakenError();
		}

		// Read back only to answer with the units: their code, their measure and
		// their own cost are the reads the margin is computed from (S3).
		const rows = await transaction.lotUnit.findMany({
			where: { id: { in: [...movement.unitIds] } },
			select: { id: true, code: true, measure: true, cost: true },
		});

		return rows
			.sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id))
			.map((row) => ({
				id: row.id,
				code: row.code,
				measure: measureText(row.measure),
				cost: moneyText(row.cost),
			}));
	}

	/** Maps a raw Prisma row back into the domain entity. */
	private toDomain(row: StockMovementModel): StockMovement {
		return StockMovement.create({
			id: row.id,
			companyId: row.companyId,
			productId: row.productId,
			type: row.type,
			quantity: row.quantity,
			reason: row.reason,
			userId: row.userId,
			customerId: row.customerId,
			lotId: row.lotId,
			unitPrice: row.unitPrice === null ? null : moneyText(row.unitPrice),
			createdAt: row.createdAt,
		});
	}
}

/**
 * A `Decimal(12,3)` column read back as the contract's normalized string.
 * A value the column cannot represent means the store is inconsistent: it is
 * reported as an unexpected error instead of inventing a rounded number.
 */
function measureText(value: string | { toString(): string }): string {
	const parsed = measureFromText(String(value));

	if (parsed === null) {
		throw new Error(`Unreadable lot unit measure: ${String(value)}`);
	}

	return formatMeasure(parsed);
}

/** A `Decimal(12,2)` column read back as the contract's normalized string. */
function moneyText(value: string | { toString(): string }): string {
	const parsed = moneyFromText(String(value));

	if (parsed === null) {
		throw new Error(`Unreadable decimal amount: ${String(value)}`);
	}

	return formatMoney(parsed);
}
