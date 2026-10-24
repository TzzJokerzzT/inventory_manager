import { StockMovement } from "../../domain/entities/stock-movement.js";
import type {
	RegisterMovementResult,
	StockMovementFilters,
	StockMovementRepository,
} from "../../domain/repositories/stock-movement-repository.js";
import type {
	PrismaClient,
	StockMovement as StockMovementModel,
} from "./generated/prisma/client.js";

/**
 * The adapter depends on the `product` and `stockMovement` delegates plus the
 * interactive `$transaction`. The type-only import is on purpose: the generated
 * client is ESM-first and Jest runs through `@swc/jest` in CommonJS, so a
 * runtime import would break the suite.
 */
type StockMovementDelegate = Pick<
	PrismaClient,
	"product" | "stockMovement" | "$transaction"
>;

export interface PrismaStockMovementRepositoryDependencies {
	prisma: StockMovementDelegate;
}

/**
 * Prisma-backed adapter for the {@link StockMovementRepository} port.
 *
 * `register` is the atomic write MOV-04 asks for, and it is built around a
 * **guarded** update instead of a read-then-write:
 *
 * 1. `updateMany` applies the delta with `where: { id, companyId, deletedAt:
 *    null }` and, for an exit, `stockQuantity: { gte: quantity }`. PostgreSQL
 *    locks the row for the update, so two concurrent exits cannot both pass the
 *    guard: the loser matches no row and the stock can never go negative.
 * 2. `count === 0` means the guard did not hold. A re-read inside the same
 *    transaction tells the two cases apart: no active product is
 *    `product_not_found`, still present is `insufficient_stock` with its stock.
 * 3. Only when the update landed is the movement inserted, so a movement never
 *    claims a stock change that did not happen. The same transaction re-reads
 *    the product to answer with the stock after the change.
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

		return this.prisma.$transaction(
			async (transaction): Promise<RegisterMovementResult> => {
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
						lotId: movement.lotId,
						createdAt: movement.createdAt,
					},
				});

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
				};
			},
		);
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
			createdAt: row.createdAt,
		});
	}
}
