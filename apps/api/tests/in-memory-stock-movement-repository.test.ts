import { Product } from "../src/domain/entities/product.js";
import { StockMovement } from "../src/domain/entities/stock-movement.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";
const PRODUCT = "product-1";

const T0 = new Date("2026-10-21T10:00:00.000Z");
const T1 = new Date("2026-10-21T11:00:00.000Z");
const T2 = new Date("2026-10-21T12:00:00.000Z");

function product(
	overrides: Partial<Parameters<typeof Product.create>[0]> = {},
) {
	return Product.create({
		id: PRODUCT,
		companyId: COMPANY,
		name: "Cafe molido 500g",
		sku: "CAF-500",
		price: "1500",
		stockQuantity: 10,
		...overrides,
	});
}

/**
 * The in-memory ledger operates on the very map the product repository serves,
 * which is the adapter-specific constructor argument under test. The helper
 * builds both views of the same state.
 */
function build(products: Product[] = [product()]) {
	const store = new Map<string, Product>(products.map((row) => [row.id, row]));
	const repository = new InMemoryStockMovementRepository(store);

	return { repository, store };
}

function movement(
	overrides: Partial<Parameters<typeof StockMovement.create>[0]> = {},
) {
	return StockMovement.create({
		id: `movement-${Math.random().toString(36).slice(2)}`,
		companyId: COMPANY,
		productId: PRODUCT,
		userId: "user-1",
		type: "IN",
		quantity: 5,
		createdAt: T0,
		...overrides,
	});
}

describe("InMemoryStockMovementRepository.register", () => {
	it("adds the quantity of an IN to the stock and returns the new stock", async () => {
		const { repository, store } = build();

		const result = await repository.register(
			movement({ type: "IN", quantity: 5 }),
		);

		expect(result).toEqual({
			kind: "registered",
			movement: expect.any(StockMovement),
			stockQuantity: 15,
		});
		// The shared store is what the product repository reads, so the change
		// has to be visible there and not only in the ledger's answer.
		expect(store.get(PRODUCT)?.stockQuantity).toBe(15);
	});

	it("subtracts the quantity of an OUT from the stock", async () => {
		const { repository, store } = build();

		const result = await repository.register(
			movement({ type: "OUT", quantity: 4 }),
		);

		expect(result).toEqual({
			kind: "registered",
			movement: expect.any(StockMovement),
			stockQuantity: 6,
		});
		expect(store.get(PRODUCT)?.stockQuantity).toBe(6);
	});

	it("lets an OUT take the stock to exactly zero", async () => {
		const { repository } = build();

		const result = await repository.register(
			movement({ type: "OUT", quantity: 10 }),
		);

		expect(result).toEqual({
			kind: "registered",
			movement: expect.any(StockMovement),
			stockQuantity: 0,
		});
	});

	it("refuses an OUT above the stock, reports what is available and leaves the stock untouched", async () => {
		const { repository, store } = build([product({ stockQuantity: 3 })]);

		const result = await repository.register(
			movement({ type: "OUT", quantity: 4 }),
		);

		expect(result).toEqual({ kind: "insufficient_stock", available: 3 });
		expect(store.get(PRODUCT)?.stockQuantity).toBe(3);
		// Nothing was recorded: a movement that did not move the stock is a lie.
		await expect(
			repository.findByCompany(COMPANY, { limit: 50 }),
		).resolves.toEqual([]);
	});

	it("answers product_not_found for an absent product and writes nothing", async () => {
		const { repository } = build([]);

		await expect(repository.register(movement())).resolves.toEqual({
			kind: "product_not_found",
		});
		await expect(
			repository.findByCompany(COMPANY, { limit: 50 }),
		).resolves.toEqual([]);
	});

	it("answers product_not_found for another company's product", async () => {
		const { repository, store } = build([
			product({ companyId: OTHER_COMPANY, stockQuantity: 10 }),
		]);

		await expect(repository.register(movement())).resolves.toEqual({
			kind: "product_not_found",
		});
		expect(store.get(PRODUCT)?.stockQuantity).toBe(10);
	});

	it("answers product_not_found for a soft-deleted product", async () => {
		const { repository } = build([
			product({ deletedAt: new Date("2026-10-22T12:00:00.000Z") }),
		]);

		await expect(repository.register(movement())).resolves.toEqual({
			kind: "product_not_found",
		});
	});

	it("keeps the customer of a sale in the stored movement", async () => {
		const { repository } = build();

		const result = await repository.register(
			movement({ type: "OUT", quantity: 4, customerId: "customer-1" }),
		);

		expect(result.kind === "registered" && result.movement.customerId).toBe(
			"customer-1",
		);
		const [stored] = await repository.findByCompany(COMPANY, { limit: 50 });
		expect(stored.customerId).toBe("customer-1");
	});

	it("records the movement it was given, with its own createdAt", async () => {
		const { repository } = build();
		const input = movement({ reason: "Compra", createdAt: T1 });

		const result = await repository.register(input);

		expect(result.kind === "registered" && result.movement).toBe(input);
		const stored = await repository.findByCompany(COMPANY, { limit: 50 });
		expect(stored.map((row) => row.id)).toEqual([input.id]);
	});
});

describe("InMemoryStockMovementRepository.findByCompany", () => {
	async function seeded() {
		// A second product of the same company, so the productId filter has a
		// history to narrow and the store stays consistent with the ledger.
		const { repository, store } = build([
			product(),
			product({ id: "product-2", name: "Azucar", sku: "SUGAR-1" }),
		]);

		await repository.register(movement({ id: "m-1", createdAt: T0 }));
		await repository.register(
			movement({ id: "m-2", type: "OUT", quantity: 2, createdAt: T1 }),
		);
		await repository.register(
			movement({ id: "m-3", productId: "product-2", createdAt: T2 }),
		);

		return { repository, store };
	}

	it("returns the company's movements, newest first", async () => {
		const { repository } = await seeded();

		const movements = await repository.findByCompany(COMPANY, { limit: 50 });

		expect(movements.map((row) => row.id)).toEqual(["m-3", "m-2", "m-1"]);
	});

	it("never returns another company's movements", async () => {
		const { repository } = build([product()]);
		await repository.register(
			movement({ id: "m-1", companyId: OTHER_COMPANY }),
		);

		await expect(
			repository.findByCompany(COMPANY, { limit: 50 }),
		).resolves.toEqual([]);
	});

	it("filters by productId", async () => {
		const { repository } = await seeded();

		const movements = await repository.findByCompany(COMPANY, {
			productId: "product-2",
			limit: 50,
		});

		expect(movements.map((row) => row.id)).toEqual(["m-3"]);
	});

	it("filters by type", async () => {
		const { repository } = await seeded();

		const movements = await repository.findByCompany(COMPANY, {
			type: "OUT",
			limit: 50,
		});

		expect(movements.map((row) => row.id)).toEqual(["m-2"]);
	});

	it("applies the limit after ordering, so it keeps the newest rows", async () => {
		const { repository } = await seeded();

		const movements = await repository.findByCompany(COMPANY, { limit: 2 });

		expect(movements.map((row) => row.id)).toEqual(["m-3", "m-2"]);
	});

	/**
	 * Two sales of one customer, one sale of another customer and an anonymous
	 * entry, so the customer filter has a history to narrow.
	 */
	async function seededWithCustomers() {
		const { repository, store } = build();

		await repository.register(
			movement({ id: "m-1", quantity: 5, createdAt: T0 }),
		);
		await repository.register(
			movement({
				id: "m-2",
				type: "OUT",
				quantity: 1,
				customerId: "customer-1",
				createdAt: T1,
			}),
		);
		await repository.register(
			movement({
				id: "m-3",
				type: "OUT",
				quantity: 1,
				customerId: "customer-1",
				createdAt: T2,
			}),
		);
		await repository.register(
			movement({
				id: "m-4",
				type: "OUT",
				quantity: 1,
				customerId: "customer-2",
				createdAt: new Date("2026-10-21T13:00:00.000Z"),
			}),
		);

		return { repository, store };
	}

	it("filters by customerId, keeping the order and the limit", async () => {
		const { repository } = await seededWithCustomers();

		const movements = await repository.findByCompany(COMPANY, {
			customerId: "customer-1",
			limit: 50,
		});
		const limited = await repository.findByCompany(COMPANY, {
			customerId: "customer-1",
			limit: 1,
		});

		expect(movements.map((row) => row.id)).toEqual(["m-3", "m-2"]);
		// The order is still newest first and the limit still keeps the newest.
		expect(limited.map((row) => row.id)).toEqual(["m-3"]);
	});

	it("returns no rows for a customer whose movements belong to another company", async () => {
		const { repository } = build([
			product(),
			product({ id: "product-other", companyId: OTHER_COMPANY }),
		]);
		// The sale is recorded under its own company, so the ledger really has
		// it and the empty answer below is the company scoping.
		await repository.register(
			movement({
				id: "m-1",
				companyId: OTHER_COMPANY,
				productId: "product-other",
				type: "OUT",
				customerId: "customer-9",
			}),
		);
		// A sale of our own company proves the empty answer below is the customer
		// filter and not an empty ledger.
		await repository.register(
			movement({
				id: "m-2",
				quantity: 1,
				customerId: "customer-1",
			}),
		);

		await expect(
			repository.findByCompany(OTHER_COMPANY, {
				customerId: "customer-9",
				limit: 50,
			}),
		).resolves.toHaveLength(1);
		await expect(
			repository.findByCompany(COMPANY, {
				customerId: "customer-9",
				limit: 50,
			}),
		).resolves.toEqual([]);
	});
});

describe("InMemoryStockMovementRepository.findSince", () => {
	const SINCE = new Date("2026-10-20T00:00:00.000Z");

	/**
	 * Three movements of our company around the boundary of the range and one of
	 * another company inside it, so both the date and the company are observable.
	 */
	async function seeded() {
		const { repository } = build();

		repository.save(
			movement({
				id: "m-1",
				quantity: 2,
				createdAt: new Date("2026-10-21T10:00:00.000Z"),
			}),
		);
		repository.save(
			movement({
				id: "m-2",
				quantity: 3,
				createdAt: new Date("2026-10-20T00:00:00.000Z"),
			}),
		);
		repository.save(
			movement({
				id: "m-3",
				quantity: 4,
				createdAt: new Date("2026-10-19T23:59:59.000Z"),
			}),
		);
		repository.save(
			movement({
				id: "m-4",
				companyId: OTHER_COMPANY,
				quantity: 6,
				createdAt: new Date("2026-10-21T10:30:00.000Z"),
			}),
		);

		return { repository };
	}

	it("returns the company's movements from the given date on, oldest first", async () => {
		const { repository } = await seeded();

		const found = await repository.findSince(COMPANY, SINCE);

		// `m-3` is one second before the range and stays out; `m-2` sits exactly
		// on the boundary and is included.
		expect(found.map((row) => row.id)).toEqual(["m-2", "m-1"]);
	});

	it("never returns another company's movements, even when they are in the range", async () => {
		const { repository } = await seeded();

		const found = await repository.findSince(OTHER_COMPANY, SINCE);

		expect(found.map((row) => row.id)).toEqual(["m-4"]);
	});

	it("answers no rows when the range has no movements", async () => {
		const { repository } = await seeded();

		await expect(
			repository.findSince(COMPANY, new Date("2026-12-01T00:00:00.000Z")),
		).resolves.toEqual([]);
	});
});
