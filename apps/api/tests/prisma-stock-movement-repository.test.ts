import { StockMovement } from "../src/domain/entities/stock-movement.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaStockMovementRepository } from "../src/infrastructure/database/prisma-stock-movement-repository.js";

/**
 * The adapter depends on the `product` and `stockMovement` delegates plus
 * `$transaction`. The double is hand-written: no database and no generated
 * client is loaded here. `$transaction` is an *interactive* transaction, so the
 * fake runs the callback with a transaction client carrying the same mocks.
 */
type StockMovementDelegate = Pick<
	PrismaClient,
	"product" | "stockMovement" | "$transaction"
>;

function buildFakeDelegate() {
	const productFindFirst = jest.fn();
	const productUpdateMany = jest.fn();
	const stockMovementCreate = jest.fn();
	const stockMovementFindMany = jest.fn();

	const transactionClient = {
		product: { findFirst: productFindFirst, updateMany: productUpdateMany },
		stockMovement: { create: stockMovementCreate },
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
				createdAt: CREATED_AT,
			},
		});
		expect(result).toEqual({
			kind: "registered",
			movement: expect.any(StockMovement),
			stockQuantity: 25,
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
