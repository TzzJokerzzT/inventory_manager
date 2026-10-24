import { StockMovement } from "../src/domain/entities/stock-movement.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaStockMovementRepository } from "../src/infrastructure/database/prisma-stock-movement-repository.js";

/**
 * The adapter depends on the product, the stock movement, the lot-unit and the
 * movement-unit delegates plus `$transaction`. The double is hand-written: no
 * database and no generated client is loaded here. `$transaction` is an
 * *interactive* transaction, so the fake runs the callback with a transaction
 * client carrying the same mocks.
 */
type StockMovementDelegate = Pick<
	PrismaClient,
	"product" | "stockMovement" | "lotUnit" | "movementUnit" | "$transaction"
>;

function buildFakeDelegate() {
	const productFindFirst = jest.fn();
	const productUpdateMany = jest.fn();
	const stockMovementCreate = jest.fn();
	const stockMovementFindMany = jest.fn();
	const stockMovementCount = jest.fn();
	const lotUnitCount = jest.fn().mockResolvedValue(0);
	const lotUnitUpdateMany = jest.fn();
	const lotUnitFindMany = jest.fn();
	const movementUnitCreateMany = jest.fn();
	const movementUnitFindMany = jest.fn();

	const transactionClient = {
		product: { findFirst: productFindFirst, updateMany: productUpdateMany },
		stockMovement: { create: stockMovementCreate },
		lotUnit: {
			count: lotUnitCount,
			updateMany: lotUnitUpdateMany,
			findMany: lotUnitFindMany,
		},
		movementUnit: { createMany: movementUnitCreateMany },
	};

	const transaction = jest.fn(
		async (callback: (client: unknown) => Promise<unknown>) =>
			callback(transactionClient),
	);

	const delegate = {
		product: { findFirst: productFindFirst, updateMany: productUpdateMany },
		stockMovement: {
			create: stockMovementCreate,
			findMany: stockMovementFindMany,
			count: stockMovementCount,
		},
		lotUnit: {
			count: lotUnitCount,
			updateMany: lotUnitUpdateMany,
			findMany: lotUnitFindMany,
		},
		movementUnit: {
			createMany: movementUnitCreateMany,
			findMany: movementUnitFindMany,
		},
		$transaction: transaction,
	} as unknown as StockMovementDelegate;

	return {
		delegate,
		transaction,
		productFindFirst,
		productUpdateMany,
		stockMovementCreate,
		stockMovementFindMany,
		stockMovementCount,
		lotUnitCount,
		lotUnitUpdateMany,
		lotUnitFindMany,
		movementUnitCreateMany,
		movementUnitFindMany,
	};
}

const CREATED_AT = new Date("2026-10-21T12:00:00.000Z");

function productRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "product-1",
		companyId: "company-1",
		stockQuantity: 15,
		deletedAt: null,
		...overrides,
	};
}

function movementRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "movement-1",
		companyId: "company-1",
		productId: "product-1",
		type: "IN",
		quantity: 10,
		reason: null,
		userId: "user-1",
		customerId: null,
		unitPrice: null,
		lotId: null,
		createdAt: CREATED_AT,
		...overrides,
	};
}

function movement(
	overrides: Partial<Parameters<typeof StockMovement.create>[0]> = {},
) {
	return StockMovement.create({
		id: "movement-1",
		companyId: "company-1",
		productId: "product-1",
		userId: "user-1",
		type: "IN",
		quantity: 10,
		createdAt: CREATED_AT,
		...overrides,
	});
}

describe("PrismaStockMovementRepository.register", () => {
	it("adds an IN inside one interactive transaction and returns the new stock", async () => {
		const {
			delegate,
			transaction,
			productUpdateMany,
			productFindFirst,
			stockMovementCreate,
		} = buildFakeDelegate();
		productUpdateMany.mockResolvedValue({ count: 1 });
		productFindFirst.mockResolvedValue(productRow({ stockQuantity: 25 }));
		stockMovementCreate.mockResolvedValue(movementRow());

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const result = await repository.register(
			movement({ type: "IN", quantity: 10 }),
		);

		// One transaction wraps the guarded update and the insert (MOV-04).
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(productUpdateMany).toHaveBeenCalledWith({
			where: { id: "product-1", companyId: "company-1", deletedAt: null },
			data: { stockQuantity: { increment: 10 } },
		});
		expect(stockMovementCreate).toHaveBeenCalledWith({
			data: {
				id: "movement-1",
				companyId: "company-1",
				productId: "product-1",
				type: "IN",
				quantity: 10,
				reason: null,
				userId: "user-1",
				customerId: null,
				unitPrice: null,
				lotId: null,
				createdAt: CREATED_AT,
			},
		});
		expect(result).toEqual({
			kind: "registered",
			movement: expect.any(StockMovement),
			stockQuantity: 25,
			units: [],
		});
	});

	it("persists the customer associated with the sale", async () => {
		const {
			delegate,
			productUpdateMany,
			productFindFirst,
			stockMovementCreate,
		} = buildFakeDelegate();
		productUpdateMany.mockResolvedValue({ count: 1 });
		productFindFirst.mockResolvedValue(productRow({ stockQuantity: 6 }));
		stockMovementCreate.mockResolvedValue(
			movementRow({ type: "OUT", quantity: 4, customerId: "customer-1" }),
		);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const result = await repository.register(
			movement({
				type: "OUT",
				quantity: 4,
				customerId: "customer-1",
			}),
		);

		expect(stockMovementCreate.mock.calls[0][0].data.customerId).toBe(
			"customer-1",
		);
		expect(result.kind === "registered" && result.movement.customerId).toBe(
			"customer-1",
		);
	});

	it("guards an OUT with stockQuantity >= quantity and decrements", async () => {
		const {
			delegate,
			productUpdateMany,
			productFindFirst,
			stockMovementCreate,
		} = buildFakeDelegate();
		productUpdateMany.mockResolvedValue({ count: 1 });
		productFindFirst.mockResolvedValue(productRow({ stockQuantity: 6 }));
		stockMovementCreate.mockResolvedValue(
			movementRow({ type: "OUT", quantity: 4 }),
		);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const result = await repository.register(
			movement({ type: "OUT", quantity: 4 }),
		);

		expect(productUpdateMany).toHaveBeenCalledWith({
			where: {
				id: "product-1",
				companyId: "company-1",
				deletedAt: null,
				stockQuantity: { gte: 4 },
			},
			data: { stockQuantity: { increment: -4 } },
		});
		expect(result).toEqual({
			kind: "registered",
			movement: expect.any(StockMovement),
			stockQuantity: 6,
			units: [],
		});
	});

	it("does not insert a movement when the guarded update matched no row", async () => {
		const {
			delegate,
			productUpdateMany,
			productFindFirst,
			stockMovementCreate,
		} = buildFakeDelegate();
		productUpdateMany.mockResolvedValue({ count: 0 });
		productFindFirst.mockResolvedValue(productRow({ stockQuantity: 3 }));

		const repository = new PrismaStockMovementRepository({ prisma: delegate });

		await expect(
			repository.register(movement({ type: "OUT", quantity: 4 })),
		).resolves.toEqual({ kind: "insufficient_stock", available: 3 });
		expect(stockMovementCreate).not.toHaveBeenCalled();
	});

	it("answers product_not_found when the re-read finds no active product", async () => {
		const {
			delegate,
			productUpdateMany,
			productFindFirst,
			stockMovementCreate,
		} = buildFakeDelegate();
		productUpdateMany.mockResolvedValue({ count: 0 });
		productFindFirst.mockResolvedValue(null);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });

		await expect(repository.register(movement())).resolves.toEqual({
			kind: "product_not_found",
		});
		expect(stockMovementCreate).not.toHaveBeenCalled();
	});

	it("does not require units for an entry, even when the product has them", async () => {
		const {
			delegate,
			lotUnitCount,
			productUpdateMany,
			productFindFirst,
			stockMovementCreate,
		} = buildFakeDelegate();
		productUpdateMany.mockResolvedValue({ count: 1 });
		productFindFirst.mockResolvedValue(productRow({ stockQuantity: 11 }));
		stockMovementCreate.mockResolvedValue(movementRow());

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const result = await repository.register(
			movement({ type: "IN", quantity: 10 }),
		);

		// L9 is a rule about sales: an entry never reads the units at all.
		expect(result).toEqual({
			kind: "registered",
			movement: expect.any(StockMovement),
			stockQuantity: 11,
			units: [],
		});
		expect(lotUnitCount).not.toHaveBeenCalled();
	});

	it("answers units_required when the product has available units and the sale names none", async () => {
		const { delegate, lotUnitCount, productUpdateMany, stockMovementCreate } =
			buildFakeDelegate();
		lotUnitCount.mockResolvedValue(2);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const result = await repository.register(
			movement({ type: "OUT", quantity: 2 }),
		);

		// L9/L10: the requirement is decided inside the same transaction that
		// writes the sale, and nothing was written before it failed.
		expect(lotUnitCount).toHaveBeenCalledWith({
			where: {
				status: "AVAILABLE",
				lot: { companyId: "company-1", productId: "product-1" },
			},
		});
		expect(result).toEqual({ kind: "units_required" });
		expect(productUpdateMany).not.toHaveBeenCalled();
		expect(stockMovementCreate).not.toHaveBeenCalled();
	});

	it("answers units_required when the quantity does not match the units", async () => {
		const { delegate, lotUnitCount, productUpdateMany } = buildFakeDelegate();
		lotUnitCount.mockResolvedValue(2);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });

		await expect(
			repository.register(
				movement({
					type: "OUT",
					quantity: 2,
					unitPrice: "250",
					unitIds: ["unit-1"],
				}),
			),
		).resolves.toEqual({ kind: "units_required" });
		expect(productUpdateMany).not.toHaveBeenCalled();
	});

	it("marks the units SOLD, links them and stores the written price", async () => {
		const {
			delegate,
			lotUnitCount,
			productUpdateMany,
			productFindFirst,
			stockMovementCreate,
			lotUnitUpdateMany,
			lotUnitFindMany,
			movementUnitCreateMany,
		} = buildFakeDelegate();
		lotUnitCount.mockResolvedValue(2);
		productUpdateMany.mockResolvedValue({ count: 1 });
		productFindFirst.mockResolvedValue(productRow({ stockQuantity: 1 }));
		lotUnitUpdateMany.mockResolvedValue({ count: 1 });
		lotUnitFindMany.mockResolvedValue([
			{ id: "unit-1", code: "R-01", measure: "5.000", cost: "100.00" },
		]);
		stockMovementCreate.mockResolvedValue(
			movementRow({ type: "OUT", quantity: 1, unitPrice: "250.00" }),
		);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const result = await repository.register(
			movement({
				type: "OUT",
				quantity: 1,
				unitPrice: "250",
				unitIds: ["unit-1"],
			}),
		);

		// The unit write is guarded by `status: AVAILABLE` and scoped to the
		// product's own lots, so a unit of another product or company can never
		// be taken.
		expect(lotUnitUpdateMany).toHaveBeenCalledWith({
			where: {
				id: { in: ["unit-1"] },
				status: "AVAILABLE",
				lot: { companyId: "company-1", productId: "product-1" },
			},
			data: { status: "SOLD" },
		});
		expect(stockMovementCreate.mock.calls[0][0].data.unitPrice).toBe("250.00");
		expect(movementUnitCreateMany).toHaveBeenCalledWith({
			data: [{ movementId: "movement-1", lotUnitId: "unit-1" }],
		});
		expect(result).toEqual({
			kind: "registered",
			movement: expect.any(StockMovement),
			stockQuantity: 1,
			units: [{ id: "unit-1", code: "R-01", measure: "5.000", cost: "100.00" }],
		});
	});

	it("answers unit_not_available and writes nothing when a unit was already taken", async () => {
		const {
			delegate,
			lotUnitCount,
			productUpdateMany,
			lotUnitUpdateMany,
			stockMovementCreate,
			movementUnitCreateMany,
		} = buildFakeDelegate();
		lotUnitCount.mockResolvedValue(2);
		productUpdateMany.mockResolvedValue({ count: 1 });
		// The guard matched no row: the unit was sold between the count and the
		// write, or never belonged to this product.
		lotUnitUpdateMany.mockResolvedValue({ count: 0 });

		const repository = new PrismaStockMovementRepository({ prisma: delegate });

		await expect(
			repository.register(
				movement({
					type: "OUT",
					quantity: 1,
					unitPrice: "250",
					unitIds: ["unit-1"],
				}),
			),
		).resolves.toEqual({ kind: "unit_not_available" });
		// The callback threw, so the transaction is rolled back: no movement and
		// no link row survive the failed unit write.
		expect(stockMovementCreate).not.toHaveBeenCalled();
		expect(movementUnitCreateMany).not.toHaveBeenCalled();
	});
});

describe("PrismaStockMovementRepository.findUnitsByMovementIds", () => {
	it("reads the units of the given movements, scoped by company, ordered by code", async () => {
		const { delegate, movementUnitFindMany } = buildFakeDelegate();
		movementUnitFindMany.mockResolvedValue([
			{
				movementId: "movement-1",
				lotUnit: {
					id: "unit-2",
					code: "R-02",
					measure: "3.000",
					cost: "60.00",
				},
			},
			{
				movementId: "movement-1",
				lotUnit: {
					id: "unit-1",
					code: "R-01",
					measure: "5.000",
					cost: "100.00",
				},
			},
		]);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const found = await repository.findUnitsByMovementIds("company-1", [
			"movement-1",
		]);

		expect(movementUnitFindMany).toHaveBeenCalledWith({
			where: {
				movementId: { in: ["movement-1"] },
				movement: { companyId: "company-1" },
			},
			select: {
				movementId: true,
				lotUnit: {
					select: { id: true, code: true, measure: true, cost: true },
				},
			},
		});
		expect(found.get("movement-1")).toEqual([
			{ id: "unit-1", code: "R-01", measure: "5.000", cost: "100.00" },
			{ id: "unit-2", code: "R-02", measure: "3.000", cost: "60.00" },
		]);
	});

	it("answers an empty map without querying when there are no movements", async () => {
		const { delegate, movementUnitFindMany } = buildFakeDelegate();

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const found = await repository.findUnitsByMovementIds("company-1", []);

		expect(found.size).toBe(0);
		expect(movementUnitFindMany).not.toHaveBeenCalled();
	});
});

describe("PrismaStockMovementRepository.findByCompany", () => {
	it("composes the company, product and type filters, newest first, bounded by the limit", async () => {
		const { delegate, stockMovementFindMany } = buildFakeDelegate();
		stockMovementFindMany.mockResolvedValue([movementRow()]);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const found = await repository.findByCompany("company-1", {
			productId: "product-1",
			type: "IN",
			limit: 20,
		});

		expect(stockMovementFindMany).toHaveBeenCalledWith({
			where: { companyId: "company-1", productId: "product-1", type: "IN" },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: 20,
		});
		expect(found.map((row) => row.id)).toEqual(["movement-1"]);
	});

	it("omits the filters that were not given", async () => {
		const { delegate, stockMovementFindMany } = buildFakeDelegate();
		stockMovementFindMany.mockResolvedValue([]);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		await repository.findByCompany("company-1", { limit: 50 });

		expect(stockMovementFindMany).toHaveBeenCalledWith({
			where: { companyId: "company-1" },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: 50,
		});
	});

	it("puts the customerId in the where, keeping the order and the limit", async () => {
		const { delegate, stockMovementFindMany } = buildFakeDelegate();
		stockMovementFindMany.mockResolvedValue([
			movementRow({ type: "OUT", customerId: "customer-1" }),
		]);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const found = await repository.findByCompany("company-1", {
			customerId: "customer-1",
			limit: 20,
		});

		expect(stockMovementFindMany).toHaveBeenCalledWith({
			where: { companyId: "company-1", customerId: "customer-1" },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: 20,
		});
		expect(found.map((row) => row.id)).toEqual(["movement-1"]);
	});

	it("composes the customerId with the product and type filters", async () => {
		const { delegate, stockMovementFindMany } = buildFakeDelegate();
		stockMovementFindMany.mockResolvedValue([
			movementRow({ type: "OUT", customerId: "customer-1" }),
		]);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		await repository.findByCompany("company-1", {
			productId: "product-1",
			customerId: "customer-1",
			type: "OUT",
			limit: 20,
		});

		expect(stockMovementFindMany).toHaveBeenCalledWith({
			where: {
				companyId: "company-1",
				productId: "product-1",
				customerId: "customer-1",
				type: "OUT",
			},
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: 20,
		});
	});

	it("maps the rows back into domain entities, keeping the reason", async () => {
		const { delegate, stockMovementFindMany } = buildFakeDelegate();
		stockMovementFindMany.mockResolvedValue([
			movementRow({ type: "OUT", quantity: 2, reason: "Venta" }),
		]);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const [found] = await repository.findByCompany("company-1", { limit: 50 });

		expect(found).toBeInstanceOf(StockMovement);
		expect(found?.toJSON()).toEqual({
			id: "movement-1",
			companyId: "company-1",
			productId: "product-1",
			type: "OUT",
			quantity: 2,
			reason: "Venta",
			userId: "user-1",
			customerId: null,
			lotId: null,
			unitPrice: null,
			createdAt: "2026-10-21T12:00:00.000Z",
		});
	});

	it("maps the customerId of a sale back from the row", async () => {
		const { delegate, stockMovementFindMany } = buildFakeDelegate();
		stockMovementFindMany.mockResolvedValue([
			movementRow({ type: "OUT", quantity: 2, customerId: "customer-1" }),
		]);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const [found] = await repository.findByCompany("company-1", { limit: 50 });

		expect(found?.customerId).toBe("customer-1");
	});
});

describe("PrismaStockMovementRepository.findSince", () => {
	const SINCE = new Date("2026-09-22T00:00:00.000Z");

	it("reads the company's movements from the given date on, oldest first", async () => {
		const { delegate, stockMovementFindMany } = buildFakeDelegate();
		stockMovementFindMany.mockResolvedValue([movementRow()]);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const found = await repository.findSince("company-1", SINCE);

		// The range read is company-scoped in the WHERE and ascending, with the
		// id as the tie-break so two reads of the same state agree.
		expect(stockMovementFindMany).toHaveBeenCalledWith({
			where: { companyId: "company-1", createdAt: { gte: SINCE } },
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		});
		expect(found.map((row) => row.id)).toEqual(["movement-1"]);
	});

	it("maps the rows back into domain entities", async () => {
		const { delegate, stockMovementFindMany } = buildFakeDelegate();
		stockMovementFindMany.mockResolvedValue([
			movementRow({ type: "OUT", quantity: 2 }),
		]);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });
		const [found] = await repository.findSince("company-1", SINCE);

		expect(found).toBeInstanceOf(StockMovement);
		expect(found?.toJSON()).toEqual({
			id: "movement-1",
			companyId: "company-1",
			productId: "product-1",
			type: "OUT",
			quantity: 2,
			reason: null,
			userId: "user-1",
			customerId: null,
			lotId: null,
			unitPrice: null,
			createdAt: "2026-10-21T12:00:00.000Z",
		});
	});

	it("answers no rows when the range has no movements", async () => {
		const { delegate, stockMovementFindMany } = buildFakeDelegate();
		stockMovementFindMany.mockResolvedValue([]);

		const repository = new PrismaStockMovementRepository({ prisma: delegate });

		await expect(repository.findSince("company-1", SINCE)).resolves.toEqual([]);
	});
});

describe("PrismaStockMovementRepository.countByProduct", () => {
	it("counts the company's movements of one product", async () => {
		const { delegate, stockMovementCount } = buildFakeDelegate();
		stockMovementCount.mockResolvedValue(2);

		const repository = new PrismaStockMovementRepository({
			prisma: delegate,
		});

		await expect(
			repository.countByProduct("company-1", "product-1"),
		).resolves.toBe(2);
		// The company is part of the WHERE clause, so a movement of another
		// company never blocks the purge.
		expect(stockMovementCount).toHaveBeenCalledWith({
			where: { companyId: "company-1", productId: "product-1" },
		});
	});

	it("answers zero when the product has no movements", async () => {
		const { delegate, stockMovementCount } = buildFakeDelegate();
		stockMovementCount.mockResolvedValue(0);

		const repository = new PrismaStockMovementRepository({
			prisma: delegate,
		});

		await expect(
			repository.countByProduct("company-1", "product-1"),
		).resolves.toBe(0);
	});
});
