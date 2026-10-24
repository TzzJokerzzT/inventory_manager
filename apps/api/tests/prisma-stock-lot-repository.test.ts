import { StockLot } from "../src/domain/entities/stock-lot.js";
import { ProductNotFoundError } from "../src/domain/errors/product-not-found-error.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaStockLotRepository } from "../src/infrastructure/database/prisma-stock-lot-repository.js";

/**
 * The adapter talks to the three delegates plus the interactive `$transaction`.
 * The double is hand-written: no database and no generated client is loaded
 * here, and the fake runs the callback with a transaction client carrying the
 * same mocks.
 */
type StockLotDelegate = Pick<
	PrismaClient,
	"stockLot" | "lotUnit" | "product" | "stockMovement" | "$transaction"
>;

function buildFakeDelegate() {
	const stockLotCreate = jest.fn();
	const stockLotFindMany = jest.fn();
	const lotUnitGroupBy = jest.fn();
	const lotUnitFindMany = jest.fn();
	const productUpdateMany = jest.fn();
	const stockMovementCreate = jest.fn();

	const transactionClient = {
		stockLot: { create: stockLotCreate },
		product: { updateMany: productUpdateMany },
		stockMovement: { create: stockMovementCreate },
	};

	const transaction = jest.fn(
		async (callback: (client: unknown) => Promise<unknown>) =>
			callback(transactionClient),
	);

	const delegate = {
		stockLot: { create: stockLotCreate, findMany: stockLotFindMany },
		lotUnit: { groupBy: lotUnitGroupBy, findMany: lotUnitFindMany },
		product: { updateMany: productUpdateMany },
		stockMovement: { create: stockMovementCreate },
		$transaction: transaction,
	} as unknown as StockLotDelegate;

	return {
		delegate,
		transaction,
		stockLotCreate,
		stockLotFindMany,
		lotUnitGroupBy,
		lotUnitFindMany,
		productUpdateMany,
		stockMovementCreate,
	};
}

/**
 * A Prisma `Decimal` is an object whose `toString()` carries the full
 * precision -- the only shape the adapter may rely on, since the generated
 * client is imported type-only.
 */
function decimal(raw: string): { toString: () => string } {
	return { toString: () => raw };
}

const CREATED_AT = new Date("2026-10-21T12:00:00.000Z");
const USER_ID = "88888888-9999-4aaa-8bbb-cccccccccccc";

function lot() {
	return StockLot.create({
		id: "lot-1",
		companyId: "company-1",
		productId: "product-1",
		supplierId: "supplier-1",
		costPerMeasure: "100",
		measures: [1.5, 2.25],
		note: "Factura 1234",
		createdAt: CREATED_AT,
	});
}

describe("PrismaStockLotRepository.register", () => {
	it("writes the lot with its units, the IN movement and the stock increment in one transaction", async () => {
		const {
			delegate,
			transaction,
			stockLotCreate,
			productUpdateMany,
			stockMovementCreate,
		} = buildFakeDelegate();
		stockLotCreate.mockResolvedValue({});
		productUpdateMany.mockResolvedValue({ count: 1 });
		stockMovementCreate.mockResolvedValue({});

		const created = await new PrismaStockLotRepository({
			prisma: delegate,
		}).register(lot(), USER_ID);

		expect(transaction).toHaveBeenCalledTimes(1);

		// The lot and its units in one nested write: the codes, the measures and
		// the per-unit costs the entity derived.
		expect(stockLotCreate).toHaveBeenCalledWith({
			data: {
				id: "lot-1",
				companyId: "company-1",
				productId: "product-1",
				supplierId: "supplier-1",
				receivedAt: CREATED_AT,
				measureTotal: "3.750",
				costPerMeasure: "100.00",
				unitCount: 2,
				note: "Factura 1234",
				createdAt: CREATED_AT,
				units: {
					create: [
						{
							id: expect.any(String),
							code: "R-01",
							measure: "1.500",
							cost: "150.00",
							status: "AVAILABLE",
							createdAt: CREATED_AT,
						},
						{
							id: expect.any(String),
							code: "R-02",
							measure: "2.250",
							cost: "225.00",
							status: "AVAILABLE",
							createdAt: CREATED_AT,
						},
					],
				},
			},
		});

		// S7: the stock counts whole units, and only an active product of the
		// company is incremented.
		expect(productUpdateMany).toHaveBeenCalledWith({
			where: { id: "product-1", companyId: "company-1", deletedAt: null },
			data: { stockQuantity: { increment: 2 } },
		});

		// The entry that brings the lot in, linked back to it.
		expect(stockMovementCreate).toHaveBeenCalledWith({
			data: {
				companyId: "company-1",
				productId: "product-1",
				type: "IN",
				quantity: 2,
				reason: "Factura 1234",
				userId: USER_ID,
				customerId: null,
				lotId: "lot-1",
				createdAt: CREATED_AT,
			},
		});

		expect(created).toMatchObject({
			id: "lot-1",
			measureTotal: "3.750",
			unitCount: 2,
		});
		expect(created.toJSON().units.map((unit) => unit.cost)).toEqual([
			"150.00",
			"225.00",
		]);
	});

	it("throws product_not_found and rolls everything back when the product is gone", async () => {
		const { delegate, stockLotCreate, productUpdateMany, stockMovementCreate } =
			buildFakeDelegate();
		stockLotCreate.mockResolvedValue({});
		// The guarded update matched no row: the product was deleted or moved to
		// another company between the use case's read and this write.
		productUpdateMany.mockResolvedValue({ count: 0 });

		await expect(
			new PrismaStockLotRepository({ prisma: delegate }).register(
				lot(),
				USER_ID,
			),
		).rejects.toThrow(ProductNotFoundError);

		// The movement is written last on purpose: a lot whose stock could not be
		// incremented leaves no audit row, and the transaction discards the rest.
		expect(stockMovementCreate).not.toHaveBeenCalled();
	});
});

/**
 * The three reads of L12 are pinned by their query shape: the company always
 * travels in the WHERE (isolation), the money and the measure are read back as
 * the contract's normalized strings, and "the latest lot" has exactly one
 * order.
 */
describe("PrismaStockLotRepository reads", () => {
	it("sums the available units of each product with the company in the query", async () => {
		const { delegate, stockLotFindMany, lotUnitGroupBy } = buildFakeDelegate();
		lotUnitGroupBy.mockResolvedValue([
			{
				lotId: "lot-1",
				_count: { _all: 2 },
				_sum: { measure: decimal("4.5"), cost: decimal("900") },
			},
			{
				lotId: "lot-2",
				_count: { _all: 1 },
				_sum: { measure: decimal("1.5"), cost: decimal("300") },
			},
			{
				lotId: "lot-3",
				_count: { _all: 1 },
				_sum: { measure: decimal("2.0"), cost: decimal("700") },
			},
		]);
		stockLotFindMany.mockResolvedValue([
			{ id: "lot-1", productId: "product-1" },
			{ id: "lot-2", productId: "product-1" },
			{ id: "lot-3", productId: "product-2" },
		]);

		const totals = await new PrismaStockLotRepository({
			prisma: delegate,
		}).findAvailableUnitTotals("company-1", ["product-1", "product-2"]);

		expect(lotUnitGroupBy).toHaveBeenCalledWith({
			by: ["lotId"],
			where: {
				status: "AVAILABLE",
				lot: {
					companyId: "company-1",
					productId: { in: ["product-1", "product-2"] },
				},
			},
			_count: { _all: true },
			_sum: { measure: true, cost: true },
		});
		expect(totals.get("product-1")).toEqual({
			unitCount: 3,
			measureTotal: "6.000",
			costTotal: "1200.00",
		});
		expect(totals.get("product-2")).toEqual({
			unitCount: 1,
			measureTotal: "2.000",
			costTotal: "700.00",
		});
	});

	it("answers no totals without asking the database when no product was given", async () => {
		const { delegate, lotUnitGroupBy } = buildFakeDelegate();

		await expect(
			new PrismaStockLotRepository({
				prisma: delegate,
			}).findAvailableUnitTotals("company-1", []),
		).resolves.toEqual(new Map());
		expect(lotUnitGroupBy).not.toHaveBeenCalled();
	});

	it("reads the latest lots of a product newest first with the count of available units", async () => {
		const { delegate, stockLotFindMany } = buildFakeDelegate();
		stockLotFindMany.mockResolvedValue([
			{
				id: "lot-2",
				productId: "product-1",
				supplierId: "supplier-1",
				receivedAt: CREATED_AT,
				measureTotal: decimal("10"),
				costPerMeasure: decimal("5900"),
				unitCount: 2,
				_count: { units: 1 },
			},
		]);

		const lots = await new PrismaStockLotRepository({
			prisma: delegate,
		}).findLatestByProduct("company-1", "product-1", 50);

		expect(stockLotFindMany).toHaveBeenCalledWith({
			where: { companyId: "company-1", productId: "product-1" },
			orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
			take: 50,
			select: {
				id: true,
				productId: true,
				supplierId: true,
				receivedAt: true,
				measureTotal: true,
				costPerMeasure: true,
				unitCount: true,
				_count: { select: { units: { where: { status: "AVAILABLE" } } } },
			},
		});
		expect(lots).toEqual([
			{
				id: "lot-2",
				productId: "product-1",
				supplierId: "supplier-1",
				receivedAt: CREATED_AT,
				measureTotal: "10.000",
				costPerMeasure: "5900.00",
				unitCount: 2,
				availableUnits: 1,
			},
		]);
	});

	it("reads the latest lot of each supplier inside the company", async () => {
		const { delegate, stockLotFindMany } = buildFakeDelegate();
		stockLotFindMany.mockResolvedValue([
			{
				id: "lot-9",
				productId: "product-1",
				supplierId: "supplier-1",
				receivedAt: CREATED_AT,
				costPerMeasure: decimal("5900"),
			},
		]);

		const latest = await new PrismaStockLotRepository({
			prisma: delegate,
		}).findLatestBySupplier("company-1", ["supplier-1", "supplier-2"]);

		expect(stockLotFindMany).toHaveBeenCalledWith({
			where: {
				companyId: "company-1",
				supplierId: { in: ["supplier-1", "supplier-2"] },
			},
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
		expect(latest.get("supplier-1")).toEqual({
			id: "lot-9",
			productId: "product-1",
			receivedAt: CREATED_AT,
			costPerMeasure: "5900.00",
		});
		expect(latest.has("supplier-2")).toBe(false);
	});
});

describe("PrismaStockLotRepository.findUnitsByProduct", () => {
	it("reads the units of the product oldest lot first, then by code", async () => {
		const { delegate, lotUnitFindMany } = buildFakeDelegate();
		lotUnitFindMany.mockResolvedValue([
			{
				id: "unit-1",
				code: "R-01",
				measure: decimal("2"),
				cost: decimal("2000"),
				status: "AVAILABLE",
				lot: { id: "lot-1", receivedAt: CREATED_AT },
			},
			{
				id: "unit-2",
				code: "R-02",
				measure: decimal("4.5"),
				cost: decimal("4500.50"),
				status: "SOLD",
				lot: { id: "lot-1", receivedAt: CREATED_AT },
			},
		]);

		const units = await new PrismaStockLotRepository({
			prisma: delegate,
		}).findUnitsByProduct("company-1", "product-1", "ALL");

		// The order is the port's: the lot's date first (so a sale offers the
		// oldest stock), then the code inside the lot.
		expect(lotUnitFindMany).toHaveBeenCalledWith({
			where: { lot: { companyId: "company-1", productId: "product-1" } },
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
		expect(units).toEqual([
			{
				id: "unit-1",
				code: "R-01",
				measure: "2.000",
				cost: "2000.00",
				status: "AVAILABLE",
				lotId: "lot-1",
				receivedAt: CREATED_AT,
			},
			{
				id: "unit-2",
				code: "R-02",
				measure: "4.500",
				cost: "4500.50",
				status: "SOLD",
				lotId: "lot-1",
				receivedAt: CREATED_AT,
			},
		]);
	});

	it("filters by the requested status inside the WHERE clause", async () => {
		const { delegate, lotUnitFindMany } = buildFakeDelegate();
		lotUnitFindMany.mockResolvedValue([]);

		const repository = new PrismaStockLotRepository({ prisma: delegate });

		await repository.findUnitsByProduct("company-1", "product-1", "SOLD");

		expect(lotUnitFindMany).toHaveBeenLastCalledWith(
			expect.objectContaining({
				where: {
					status: "SOLD",
					lot: { companyId: "company-1", productId: "product-1" },
				},
			}),
		);
	});
});
