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
	"stockLot" | "product" | "stockMovement" | "$transaction"
>;

function buildFakeDelegate() {
	const stockLotCreate = jest.fn();
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
		stockLot: { create: stockLotCreate },
		product: { updateMany: productUpdateMany },
		stockMovement: { create: stockMovementCreate },
		$transaction: transaction,
	} as unknown as StockLotDelegate;

	return {
		delegate,
		transaction,
		stockLotCreate,
		productUpdateMany,
		stockMovementCreate,
	};
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
