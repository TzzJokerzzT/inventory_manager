import type { StockLot } from "../../domain/entities/stock-lot.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import type { StockLotRepository } from "../../domain/repositories/stock-lot-repository.js";
import type { PrismaClient } from "./generated/prisma/client.js";

/**
 * The adapter depends on the `stockLot`, `product` and `stockMovement`
 * delegates plus the interactive `$transaction`. The type-only import is on
 * purpose: the generated client is ESM-first and Jest runs through `@swc/jest`
 * in CommonJS, so a runtime import would break the suite.
 */
type StockLotDelegate = Pick<
	PrismaClient,
	"stockLot" | "product" | "stockMovement" | "$transaction"
>;

export interface PrismaStockLotRepositoryDependencies {
	prisma: StockLotDelegate;
}

/**
 * Prisma-backed adapter for the {@link StockLotRepository} port.
 *
 * `register` is the single atomic write of L7, and its order is deliberate:
 *
 * 1. the lot with its units, in **one nested create**, because a unit without
 *    its lot is not a row the schema allows;
 * 2. the guarded stock increment, which only lands while the product is active
 *    in the lot's company. A `count` of 0 means it was deleted or moved between
 *    the use case's read and this write, and the transaction is aborted by
 *    throwing {@link ProductNotFoundError} -- no orphan lot survives;
 * 3. the `IN` movement **last**, so the audit row is only attempted once the
 *    stock it claims actually moved. Its `quantity` is the number of units
 *    (S7: the stock counts rolls, never kilos) and its `lotId` links it back.
 *
 * The response is the entity that was written, not a read-back: each column is
 * the entity's own normalized decimal, and a re-read would have to invent an
 * order for the units that the table does not store.
 */
export class PrismaStockLotRepository implements StockLotRepository {
	private readonly prisma: StockLotDelegate;

	constructor(dependencies: PrismaStockLotRepositoryDependencies) {
		this.prisma = dependencies.prisma;
	}

	async register(lot: StockLot, registeredByUserId: string): Promise<StockLot> {
		return this.prisma.$transaction(async (transaction): Promise<StockLot> => {
			await transaction.stockLot.create({
				data: {
					id: lot.id,
					companyId: lot.companyId,
					productId: lot.productId,
					supplierId: lot.supplierId,
					receivedAt: lot.receivedAt,
					measureTotal: lot.measureTotal,
					costPerMeasure: lot.costPerMeasure,
					unitCount: lot.unitCount,
					note: lot.note,
					createdAt: lot.createdAt,
					units: {
						create: lot.units.map((unit) => ({
							id: unit.id,
							code: unit.code,
							measure: unit.measure,
							cost: unit.cost,
							status: unit.status,
							createdAt: unit.createdAt,
						})),
					},
				},
			});

			const { count } = await transaction.product.updateMany({
				where: {
					id: lot.productId,
					companyId: lot.companyId,
					deletedAt: null,
				},
				data: { stockQuantity: { increment: lot.unitCount } },
			});

			if (count === 0) {
				throw new ProductNotFoundError();
			}

			await transaction.stockMovement.create({
				data: {
					companyId: lot.companyId,
					productId: lot.productId,
					type: "IN",
					quantity: lot.unitCount,
					// The note is the same one-line annotation the ledger's reason
					// is for, and both caps are the same (300), so the entry is not
					// left unexplained.
					reason: lot.note,
					userId: registeredByUserId,
					customerId: null,
					lotId: lot.id,
					createdAt: lot.createdAt,
				},
			});

			return lot;
		});
	}
}
