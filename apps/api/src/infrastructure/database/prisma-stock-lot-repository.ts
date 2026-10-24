import type { AvailableUnitTotals } from "../../domain/costing/derived-costs.js";
import {
	formatMeasure,
	formatMoney,
	measureFromText,
	moneyFromText,
} from "../../domain/entities/lot-unit.js";
import type { StockLot } from "../../domain/entities/stock-lot.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import type {
	ProductLotSummary,
	ProductUnitStatusFilter,
	ProductUnitSummary,
	StockLotRepository,
	SupplierLatestLot,
} from "../../domain/repositories/stock-lot-repository.js";
import type { PrismaClient } from "./generated/prisma/client.js";

/**
 * The adapter depends on the `stockLot`, `product` and `stockMovement`
 * delegates plus the interactive `$transaction`. The type-only import is on
 * purpose: the generated client is ESM-first and Jest runs through `@swc/jest`
 * in CommonJS, so a runtime import would break the suite.
 */
type StockLotDelegate = Pick<
	PrismaClient,
	"stockLot" | "lotUnit" | "product" | "stockMovement" | "$transaction"
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

	async findAvailableUnitTotals(
		companyId: string,
		productIds: string[],
	): Promise<Map<string, AvailableUnitTotals>> {
		const result = new Map<string, AvailableUnitTotals>();

		if (productIds.length === 0) {
			return result;
		}

		const sums = new Map<
			string,
			{ unitCount: number; measureMilli: bigint; costCents: bigint }
		>();

		// The database sums, the adapter only joins: grouping by lot keeps the
		// answer proportional to the lots instead of to the units. The WHERE
		// mirrors the port's contract -- the company, the products and the
		// `AVAILABLE` status -- with the lot relation carrying the first two.
		const groups = await this.prisma.lotUnit.groupBy({
			by: ["lotId"],
			where: {
				status: "AVAILABLE",
				lot: { companyId, productId: { in: productIds } },
			},
			_count: { _all: true },
			_sum: { measure: true, cost: true },
		});

		if (groups.length === 0) {
			return result;
		}

		// One extra read resolves which product each lot belongs to, because a
		// group is keyed by lot and the answer is keyed by product.
		const lots = await this.prisma.stockLot.findMany({
			where: {
				companyId,
				id: { in: groups.map((group) => group.lotId) },
			},
			select: { id: true, productId: true },
		});
		const productIdByLotId = new Map(
			lots.map((lot) => [lot.id, lot.productId]),
		);

		for (const group of groups) {
			const productId = productIdByLotId.get(group.lotId);

			if (productId === undefined) {
				throw new Error(
					`Stock lot ${group.lotId} has units but no lot row to read`,
				);
			}

			const current = sums.get(productId) ?? {
				unitCount: 0,
				measureMilli: 0n,
				costCents: 0n,
			};

			sums.set(productId, {
				unitCount: current.unitCount + (group._count._all ?? 0),
				measureMilli: current.measureMilli + measureMilli(group._sum.measure),
				costCents: current.costCents + costCents(group._sum.cost),
			});
		}

		for (const [productId, total] of sums) {
			result.set(productId, {
				unitCount: total.unitCount,
				measureTotal: formatMeasure(total.measureMilli),
				costTotal: formatMoney(total.costCents),
			});
		}

		return result;
	}

	async findLatestByProduct(
		companyId: string,
		productId: string,
		limit: number,
	): Promise<ProductLotSummary[]> {
		// The order is the port's: the business date, then the write date, then
		// the id, so "the latest lot" has one meaning for both adapters.
		const rows = await this.prisma.stockLot.findMany({
			where: { companyId, productId },
			orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
			take: limit,
			select: {
				id: true,
				productId: true,
				supplierId: true,
				receivedAt: true,
				measureTotal: true,
				costPerMeasure: true,
				unitCount: true,
				// Counted by the database instead of loading the units: the reader
				// only needs how many are still in stock.
				_count: { select: { units: { where: { status: "AVAILABLE" } } } },
			},
		});

		return rows.map((row) => ({
			id: row.id,
			productId: row.productId,
			supplierId: row.supplierId,
			receivedAt: row.receivedAt,
			measureTotal: measureText(row.measureTotal),
			costPerMeasure: moneyText(row.costPerMeasure),
			unitCount: row.unitCount,
			availableUnits: row._count.units,
		}));
	}

	async findLatestBySupplier(
		companyId: string,
		supplierIds: string[],
	): Promise<Map<string, SupplierLatestLot>> {
		const latest = new Map<string, SupplierLatestLot>();

		if (supplierIds.length === 0) {
			return latest;
		}

		// `distinct` is applied after the order (Prisma deduplicates in memory),
		// so the first row of each supplier is its most recent lot -- the same
		// tie-breaks the product read uses.
		const rows = await this.prisma.stockLot.findMany({
			where: { companyId, supplierId: { in: supplierIds } },
			orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
			distinct: ["supplierId"],
			select: {
				id: true,
				productId: true,
				supplierId: true,
				receivedAt: true,
				costPerMeasure: true,
			},
		});

		for (const row of rows) {
			latest.set(row.supplierId, {
				id: row.id,
				productId: row.productId,
				receivedAt: row.receivedAt,
				costPerMeasure: moneyText(row.costPerMeasure),
			});
		}

		return latest;
	}

	async findUnitsByProduct(
		companyId: string,
		productId: string,
		status: ProductUnitStatusFilter,
	): Promise<ProductUnitSummary[]> {
		// The order is the port's: the oldest lot first (so a sale offers the oldest
		// stock), then the code inside the lot. The WHERE carries the company and
		// the product through the lot relation, exactly like the unit reads the
		// costing slice already does, so another company's units never resolve.
		const rows = await this.prisma.lotUnit.findMany({
			where: {
				...(status === "ALL" ? {} : { status }),
				lot: { companyId, productId },
			},
			orderBy: [
				{ lot: { receivedAt: "asc" } },
				{ lot: { createdAt: "asc" } },
				{ lot: { id: "asc" } },
				{ code: "asc" },
			],
			select: {
				id: true,
				code: true,
				measure: true,
				cost: true,
				status: true,
				lot: { select: { id: true, receivedAt: true } },
			},
		});

		return rows.map((row) => ({
			id: row.id,
			lotId: row.lot.id,
			code: row.code,
			measure: measureText(row.measure),
			cost: moneyText(row.cost),
			status: row.status,
			receivedAt: row.lot.receivedAt,
		}));
	}
}

/** A `Decimal(12,3)` column read back as the contract's normalized string. */
function measureText(value: string | { toString(): string }): string {
	const parsed = measureFromText(String(value));

	if (parsed === null) {
		throw new Error(`Unreadable lot measure: ${String(value)}`);
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

/**
 * Reads a `Decimal` sum of measures in thousandths.
 *
 * The column parsers are not reused here on purpose: a **sum** of measures can
 * be wider than the `Decimal(12,3)` a single unit is stored in, so the value is
 * read as the arbitrarily wide decimal string it is.
 */
function measureMilli(value: unknown): bigint {
	return scaledFromWideText(decimalText(value), 3);
}

/** Reads a `Decimal` sum of costs in cents, with the same reasoning. */
function costCents(value: unknown): bigint {
	return scaledFromWideText(decimalText(value), 2);
}

/** A Prisma `Decimal` (or a raw value) as the decimal string it carries. */
function decimalText(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number") {
		return String(value);
	}

	if (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { toString?: unknown }).toString === "function"
	) {
		return (value as { toString: () => string }).toString();
	}

	throw new Error(`Unreadable decimal amount: ${String(value)}`);
}

/** Reads an arbitrarily wide non-negative decimal string into its scaled integer. */
function scaledFromWideText(raw: string, decimals: number): bigint {
	const match = /^(\d+)(?:\.(\d+))?$/.exec(raw.trim());

	if (match === null || (match[2] ?? "").length > decimals) {
		throw new Error(`Unreadable decimal amount: ${raw}`);
	}

	const scale = 10n ** BigInt(decimals);

	return (
		BigInt(match[1]) * scale + BigInt((match[2] ?? "").padEnd(decimals, "0"))
	);
}
