import { ListStockMovementsUseCase } from "../src/application/use-cases/list-stock-movements.js";
import { RegisterStockMovementUseCase } from "../src/application/use-cases/register-stock-movement.js";
import { Customer } from "../src/domain/entities/customer.js";
import { Product } from "../src/domain/entities/product.js";
import { StockMovement } from "../src/domain/entities/stock-movement.js";
import { User } from "../src/domain/entities/user.js";
import { CustomerNotFoundError } from "../src/domain/errors/customer-not-found-error.js";
import { CustomerRequiresExitError } from "../src/domain/errors/customer-requires-exit-error.js";
import { InsufficientStockError } from "../src/domain/errors/insufficient-stock-error.js";
import { ProductNotFoundError } from "../src/domain/errors/product-not-found-error.js";
import { InMemoryCustomerRepository } from "../src/infrastructure/database/in-memory-customer-repository.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";
import { createFakeUserRepository } from "./support/fake-user-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";
const PRODUCT = "product-1";
const SECOND_PRODUCT = "product-2";
const CUSTOMER = "customer-1";
const SECOND_CUSTOMER = "customer-2";
const FOREIGN_CUSTOMER = "customer-other";

const T0 = new Date("2026-10-21T10:00:00.000Z");
const T1 = new Date("2026-10-21T11:00:00.000Z");
const T2 = new Date("2026-10-21T12:00:00.000Z");
const T3 = new Date("2026-10-21T13:00:00.000Z");

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

const ACTOR = User.create({
	id: "user-1",
	auth0Sub: "auth0|ana",
	email: "ana@x.com",
	fullName: "Ana",
});

function customer(
	overrides: Partial<Parameters<typeof Customer.create>[0]> = {},
) {
	return Customer.create({
		id: CUSTOMER,
		companyId: COMPANY,
		name: "Maria Gonzalez",
		...overrides,
	});
}

/**
 * The use cases under test with the two in-memory adapters sharing one store:
 * the ledger applies the stock change to the same rows the product repository
 * serves, which is what makes the assertions about the resulting stock real.
 */
function build(
	options: {
		products?: Product[];
		users?: User[];
		customers?: Customer[];
	} = {},
) {
	const store = new Map<string, Product>(
		(options.products ?? [product()]).map((row) => [row.id, row]),
	);
	const productRepository = new InMemoryProductRepository([], store);
	const stockMovementRepository = new InMemoryStockMovementRepository(store);
	const userRepository = createFakeUserRepository(options.users ?? [ACTOR]);
	const customerRepository = new InMemoryCustomerRepository(
		options.customers ?? [],
	);

	return {
		store,
		productRepository,
		stockMovementRepository,
		userRepository,
		customerRepository,
		register: new RegisterStockMovementUseCase({
			productRepository,
			stockMovementRepository,
			customerRepository,
		}),
		list: new ListStockMovementsUseCase({
			stockMovementRepository,
			productRepository,
			userRepository,
			customerRepository,
		}),
	};
}

function context() {
	return {
		companyId: COMPANY,
		actor: { id: ACTOR.id, fullName: ACTOR.fullName, email: ACTOR.email },
	};
}

describe("RegisterStockMovementUseCase", () => {
	it("registers an IN, increments the stock and returns the movement with the new stock", async () => {
		const { register, productRepository } = build();

		const result = await register.execute(
			{ productId: PRODUCT, type: "IN", quantity: 5, reason: " Compra " },
			context(),
		);

		expect(result.stockQuantity).toBe(15);
		expect(result.movement).toEqual({
			id: expect.any(String),
			companyId: COMPANY,
			productId: PRODUCT,
			type: "IN",
			quantity: 5,
			reason: "Compra",
			createdAt: expect.any(String),
			customerId: null,
			customer: null,
			product: { id: PRODUCT, name: "Cafe molido 500g", sku: "CAF-500" },
			actor: { id: ACTOR.id, fullName: "Ana", email: "ana@x.com" },
		});
		await expect(
			productRepository.findActiveById(COMPANY, PRODUCT),
		).resolves.toMatchObject({ stockQuantity: 15 });
	});

	it("registers an OUT and decrements the stock", async () => {
		const { register } = build();

		const result = await register.execute(
			{ productId: PRODUCT, type: "OUT", quantity: 4 },
			context(),
		);

		expect(result.stockQuantity).toBe(6);
		expect(result.movement.type).toBe("OUT");
	});

	it("keeps an anonymous OUT valid, with no customer", async () => {
		const { register } = build();

		const result = await register.execute(
			{ productId: PRODUCT, type: "OUT", quantity: 1 },
			context(),
		);

		expect(result.movement.customerId).toBeNull();
		expect(result.movement.customer).toBeNull();
	});

	it("associates a customer with an OUT and resolves it in the view", async () => {
		const { register, stockMovementRepository } = build({
			customers: [customer()],
		});

		const result = await register.execute(
			{
				productId: PRODUCT,
				type: "OUT",
				quantity: 2,
				customerId: CUSTOMER,
			},
			context(),
		);

		expect(result.movement.customerId).toBe(CUSTOMER);
		expect(result.movement.customer).toEqual({
			id: CUSTOMER,
			name: "Maria Gonzalez",
		});
		const [stored] = await stockMovementRepository.findByCompany(COMPANY, {
			limit: 50,
		});
		expect(stored.customerId).toBe(CUSTOMER);
	});

	it("refuses an IN with a customer and records no movement", async () => {
		const { register, list, productRepository } = build({
			customers: [customer()],
		});

		const failure = await register
			.execute(
				{
					productId: PRODUCT,
					type: "IN",
					quantity: 1,
					customerId: CUSTOMER,
				},
				context(),
			)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(CustomerRequiresExitError);
		await expect(list.execute({}, { companyId: COMPANY })).resolves.toEqual([]);
		await expect(
			productRepository.findActiveById(COMPANY, PRODUCT),
		).resolves.toMatchObject({ stockQuantity: 10 });
	});

	it.each([
		["an absent customer", []],
		["another company's customer", [customer({ companyId: OTHER_COMPANY })]],
		[
			"a soft-deleted customer",
			[customer({ deletedAt: new Date("2026-10-22T12:00:00.000Z") })],
		],
	])(
		"answers CustomerNotFoundError for %s and leaves the stock and the history untouched",
		async (_label, customers) => {
			const { register, list, productRepository } = build({ customers });

			await expect(
				register.execute(
					{
						productId: PRODUCT,
						type: "OUT",
						quantity: 1,
						customerId: CUSTOMER,
					},
					context(),
				),
			).rejects.toThrow(CustomerNotFoundError);
			await expect(list.execute({}, { companyId: COMPANY })).resolves.toEqual(
				[],
			);
			// The customer is resolved before the atomic write, so the stock of a
			// rejected exit never moves.
			await expect(
				productRepository.findActiveById(COMPANY, PRODUCT),
			).resolves.toMatchObject({ stockQuantity: 10 });
		},
	);

	it("takes the actor from the company context, never from the input", async () => {
		const { register } = build();

		const result = await register.execute(
			{
				productId: PRODUCT,
				type: "IN",
				quantity: 1,
				userId: "someone",
			} as never,
			context(),
		);

		expect(result.movement.actor?.id).toBe(ACTOR.id);
	});

	it("normalizes an empty reason to null", async () => {
		const { register } = build();

		const result = await register.execute(
			{ productId: PRODUCT, type: "IN", quantity: 1, reason: "   " },
			context(),
		);

		expect(result.movement.reason).toBeNull();
	});

	it("refuses an OUT above the stock with the available amount and changes nothing", async () => {
		const { register, productRepository, list } = build({
			products: [product({ stockQuantity: 3 })],
		});

		const failure = await register
			.execute({ productId: PRODUCT, type: "OUT", quantity: 4 }, context())
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(InsufficientStockError);
		expect((failure as InsufficientStockError).available).toBe(3);
		expect((failure as InsufficientStockError).message).toContain("3");
		await expect(
			productRepository.findActiveById(COMPANY, PRODUCT),
		).resolves.toMatchObject({ stockQuantity: 3 });
		await expect(list.execute({}, { companyId: COMPANY })).resolves.toEqual([]);
	});

	it.each([
		["an absent product", []],
		["another company's product", [product({ companyId: OTHER_COMPANY })]],
		[
			"a soft-deleted product",
			[product({ deletedAt: new Date("2026-10-22T12:00:00.000Z") })],
		],
	])(
		"answers ProductNotFoundError for %s and records no movement",
		async (_label, products) => {
			const { register, list } = build({ products });

			await expect(
				register.execute(
					{ productId: PRODUCT, type: "IN", quantity: 1 },
					context(),
				),
			).rejects.toThrow(ProductNotFoundError);
			await expect(list.execute({}, { companyId: COMPANY })).resolves.toEqual(
				[],
			);
		},
	);
});

describe("ListStockMovementsUseCase", () => {
	function seedMovement(
		repository: InMemoryStockMovementRepository,
		overrides: Partial<Parameters<typeof StockMovement.create>[0]> = {},
	) {
		const movement = StockMovement.create({
			id: `movement-${Math.random().toString(36).slice(2)}`,
			companyId: COMPANY,
			productId: PRODUCT,
			userId: ACTOR.id,
			type: "IN",
			quantity: 1,
			createdAt: T0,
			...overrides,
		});

		repository.save(movement);

		return movement;
	}

	it("returns the company's movements newest first with product and actor resolved", async () => {
		const { list, stockMovementRepository } = build();
		seedMovement(stockMovementRepository, { id: "m-1", createdAt: T0 });
		seedMovement(stockMovementRepository, {
			id: "m-2",
			type: "OUT",
			quantity: 2,
			reason: "Venta",
			createdAt: T1,
		});

		const movements = await list.execute({}, { companyId: COMPANY });

		expect(movements.map((movement) => movement.id)).toEqual(["m-2", "m-1"]);
		expect(movements[0]).toEqual({
			id: "m-2",
			companyId: COMPANY,
			productId: PRODUCT,
			type: "OUT",
			quantity: 2,
			reason: "Venta",
			createdAt: T1.toISOString(),
			customerId: null,
			customer: null,
			product: { id: PRODUCT, name: "Cafe molido 500g", sku: "CAF-500" },
			actor: { id: ACTOR.id, fullName: "Ana", email: "ana@x.com" },
		});
	});

	it("resolves the customer of an exit and lists it with the movement", async () => {
		const { list, stockMovementRepository, customerRepository } = build({
			customers: [customer()],
		});
		seedMovement(stockMovementRepository, {
			id: "m-1",
			type: "OUT",
			customerId: CUSTOMER,
			createdAt: T0,
		});
		seedMovement(stockMovementRepository, {
			id: "m-2",
			type: "OUT",
			customerId: CUSTOMER,
			createdAt: T1,
		});
		seedMovement(stockMovementRepository, { id: "m-3", createdAt: T2 });
		const customerLookup = jest.spyOn(customerRepository, "findByIds");

		const movements = await list.execute({}, { companyId: COMPANY });

		// Newest first: the anonymous exit is the newest, the two sales below
		// it.
		expect(movements[0].customerId).toBeNull();
		expect(movements[0].customer).toBeNull();
		expect(movements[1].customerId).toBe(CUSTOMER);
		expect(movements[1].customer).toEqual({
			id: CUSTOMER,
			name: "Maria Gonzalez",
		});
		// Deduplicated: three movements, one customer, one lookup.
		expect(customerLookup).toHaveBeenCalledTimes(1);
		expect(customerLookup.mock.calls[0]).toEqual([COMPANY, [CUSTOMER]]);
	});

	it("keeps the customer readable after it was soft-deleted", async () => {
		const { list, stockMovementRepository, customerRepository } = build({
			customers: [customer()],
		});
		seedMovement(stockMovementRepository, {
			id: "m-1",
			type: "OUT",
			customerId: CUSTOMER,
		});
		await customerRepository.softDelete(
			COMPANY,
			CUSTOMER,
			new Date("2026-10-22T12:00:00.000Z"),
		);

		const [movement] = await list.execute({}, { companyId: COMPANY });

		expect(movement.customerId).toBe(CUSTOMER);
		expect(movement.customer).toEqual({
			id: CUSTOMER,
			name: "Maria Gonzalez",
		});
	});

	it("throws a plain error when a movement points at a customer the store lost", async () => {
		const { list, stockMovementRepository } = build();
		seedMovement(stockMovementRepository, {
			id: "m-1",
			type: "OUT",
			customerId: "ghost",
		});

		await expect(list.execute({}, { companyId: COMPANY })).rejects.toThrow(
			Error,
		);
		await expect(list.execute({}, { companyId: COMPANY })).rejects.not.toThrow(
			CustomerNotFoundError,
		);
	});

	it("filters by productId and by type", async () => {
		const { list, stockMovementRepository } = build({
			products: [
				product(),
				product({ id: "product-2", name: "Azucar", sku: "SUGAR-1" }),
			],
		});
		seedMovement(stockMovementRepository, { id: "m-1", createdAt: T0 });
		seedMovement(stockMovementRepository, {
			id: "m-2",
			type: "OUT",
			createdAt: T1,
		});
		seedMovement(stockMovementRepository, {
			id: "m-3",
			productId: "product-2",
			createdAt: T2,
		});

		const byProduct = await list.execute(
			{ productId: "product-2" },
			{ companyId: COMPANY },
		);
		const byType = await list.execute({ type: "OUT" }, { companyId: COMPANY });

		expect(byProduct.map((movement) => movement.id)).toEqual(["m-3"]);
		expect(byType.map((movement) => movement.id)).toEqual(["m-2"]);
	});

	/**
	 * Seeds two sales of one customer, one sale of another customer and an
	 * anonymous entry: enough to tell the customer filter apart from a type or
	 * a product filter.
	 */
	function seedSales(repository: InMemoryStockMovementRepository) {
		seedMovement(repository, {
			id: "m-1",
			type: "OUT",
			quantity: 1,
			customerId: CUSTOMER,
			createdAt: T0,
		});
		seedMovement(repository, {
			id: "m-2",
			productId: SECOND_PRODUCT,
			type: "OUT",
			quantity: 2,
			customerId: CUSTOMER,
			createdAt: T1,
		});
		seedMovement(repository, {
			id: "m-3",
			type: "OUT",
			quantity: 3,
			customerId: SECOND_CUSTOMER,
			createdAt: T2,
		});
		seedMovement(repository, { id: "m-4", createdAt: T3 });
	}

	function buildWithSales() {
		return build({
			products: [
				product(),
				product({ id: SECOND_PRODUCT, name: "Azucar", sku: "SUGAR-1" }),
			],
			customers: [
				customer(),
				customer({ id: SECOND_CUSTOMER, name: "Juan Perez" }),
			],
		});
	}

	it("filters by customerId, returning only that customer's movements", async () => {
		const { list, stockMovementRepository } = buildWithSales();
		seedSales(stockMovementRepository);

		const movements = await list.execute(
			{ customerId: CUSTOMER },
			{ companyId: COMPANY },
		);

		expect(movements.map((movement) => movement.id)).toEqual(["m-2", "m-1"]);
		expect(
			movements.every((movement) => movement.customerId === CUSTOMER),
		).toBe(true);
	});

	it("composes the customerId filter with the type filter", async () => {
		const { list, stockMovementRepository } = buildWithSales();
		seedSales(stockMovementRepository);

		const sales = await list.execute(
			{ customerId: CUSTOMER, type: "OUT" },
			{ companyId: COMPANY },
		);
		const entries = await list.execute(
			{ customerId: CUSTOMER, type: "IN" },
			{ companyId: COMPANY },
		);

		expect(sales.map((movement) => movement.id)).toEqual(["m-2", "m-1"]);
		// The customer only has exits, so asking for entries plus that customer
		// matches nothing: both filters are applied.
		expect(entries).toEqual([]);
	});

	it("composes the customerId filter with the productId filter", async () => {
		const { list, stockMovementRepository } = buildWithSales();
		seedSales(stockMovementRepository);

		// Both customers bought PRODUCT, so the product filter alone would keep
		// both sales and only the customer filter can drop the other one.
		const movements = await list.execute(
			{ customerId: CUSTOMER, productId: PRODUCT },
			{ companyId: COMPANY },
		);

		expect(movements.map((movement) => movement.id)).toEqual(["m-1"]);
	});

	it("does not narrow the history when customerId is absent", async () => {
		const { list, stockMovementRepository } = buildWithSales();
		seedSales(stockMovementRepository);

		const movements = await list.execute({}, { companyId: COMPANY });

		expect(movements.map((movement) => movement.id)).toEqual([
			"m-4",
			"m-3",
			"m-2",
			"m-1",
		]);
	});

	it("returns no rows for a customer that belongs to another company", async () => {
		const { list, stockMovementRepository } = build({
			customers: [
				customer({
					id: FOREIGN_CUSTOMER,
					companyId: OTHER_COMPANY,
					name: "Globex Buyer",
				}),
			],
		});
		seedMovement(stockMovementRepository, {
			id: "m-1",
			companyId: OTHER_COMPANY,
			type: "OUT",
			customerId: FOREIGN_CUSTOMER,
		});
		// A movement of our own company proves the empty answer below comes from
		// the filter and not from an empty ledger.
		seedMovement(stockMovementRepository, { id: "m-2", createdAt: T0 });

		// A customer of another company is a filter that matches nothing, not a
		// missing resource: no 404 and no separate lookup.
		await expect(
			list.execute({ customerId: FOREIGN_CUSTOMER }, { companyId: COMPANY }),
		).resolves.toEqual([]);
		// The sale does exist under its own company, so the empty answer above is
		// the company scoping and not a lost customer.
		const [foreign] = await stockMovementRepository.findByCompany(
			OTHER_COMPANY,
			{ limit: 50 },
		);
		expect(foreign.customerId).toBe(FOREIGN_CUSTOMER);
	});

	it("defaults the limit to 50 and honours an explicit one", async () => {
		const { list, stockMovementRepository } = build();
		for (let index = 0; index < 55; index += 1) {
			seedMovement(stockMovementRepository, {
				id: `movement-${String(index).padStart(2, "0")}`,
				createdAt: new Date(T0.getTime() + index * 1000),
			});
		}

		const defaulted = await list.execute({}, { companyId: COMPANY });
		const limited = await list.execute({ limit: 2 }, { companyId: COMPANY });

		expect(defaulted).toHaveLength(50);
		expect(defaulted[0].id).toBe("movement-54");
		expect(limited.map((movement) => movement.id)).toEqual([
			"movement-54",
			"movement-53",
		]);
	});

	it("resolves the product and the actor with one batch read each, never N+1", async () => {
		const { list, stockMovementRepository, productRepository, userRepository } =
			build({
				products: [
					product(),
					product({ id: "product-2", name: "Azucar", sku: "SUGAR-1" }),
				],
			});
		const productLookup = jest.spyOn(productRepository, "findByIds");
		const userLookup = jest.spyOn(userRepository, "findByIds");
		seedMovement(stockMovementRepository, { id: "m-1", createdAt: T0 });
		seedMovement(stockMovementRepository, { id: "m-2", createdAt: T1 });
		seedMovement(stockMovementRepository, {
			id: "m-3",
			productId: "product-2",
			createdAt: T2,
		});

		await list.execute({}, { companyId: COMPANY });

		expect(productLookup).toHaveBeenCalledTimes(1);
		// Deduplicated: three movements, two products and one actor.
		expect(productLookup.mock.calls[0][1].sort()).toEqual([
			"product-1",
			"product-2",
		]);
		expect(userLookup).toHaveBeenCalledTimes(1);
		expect(userLookup.mock.calls[0][0]).toEqual([ACTOR.id]);
	});

	it("keeps a movement readable after its product was soft-deleted", async () => {
		const { list, stockMovementRepository, productRepository } = build();
		seedMovement(stockMovementRepository, { id: "m-1" });
		await productRepository.softDelete(COMPANY, PRODUCT);

		const movements = await list.execute({}, { companyId: COMPANY });

		expect(movements.map((movement) => movement.id)).toEqual(["m-1"]);
		expect(movements[0].product).toEqual({
			id: PRODUCT,
			name: "Cafe molido 500g",
			sku: "CAF-500",
		});
	});

	it("answers actor: null when the user cannot be resolved", async () => {
		const { list, stockMovementRepository } = build({ users: [] });
		seedMovement(stockMovementRepository, { id: "m-1" });

		const [movement] = await list.execute({}, { companyId: COMPANY });

		expect(movement.actor).toBeNull();
	});

	it("throws a plain error when a movement points at a product the store lost", async () => {
		const { list, stockMovementRepository } = build();
		seedMovement(stockMovementRepository, { id: "m-1", productId: "ghost" });

		await expect(list.execute({}, { companyId: COMPANY })).rejects.toThrow(
			Error,
		);
		await expect(list.execute({}, { companyId: COMPANY })).rejects.not.toThrow(
			ProductNotFoundError,
		);
	});

	it("returns an empty list without issuing the batch reads", async () => {
		const { list, productRepository } = build();
		const productLookup = jest.spyOn(productRepository, "findByIds");

		await expect(list.execute({}, { companyId: COMPANY })).resolves.toEqual([]);
		expect(productLookup).not.toHaveBeenCalled();
	});
});
