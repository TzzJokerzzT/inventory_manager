import { ListStockMovementsUseCase } from "../src/application/use-cases/list-stock-movements.js";
import { RegisterStockMovementUseCase } from "../src/application/use-cases/register-stock-movement.js";
import { Product } from "../src/domain/entities/product.js";
import { StockMovement } from "../src/domain/entities/stock-movement.js";
import { User } from "../src/domain/entities/user.js";
import { InsufficientStockError } from "../src/domain/errors/insufficient-stock-error.js";
import { ProductNotFoundError } from "../src/domain/errors/product-not-found-error.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";
import { createFakeUserRepository } from "./support/fake-user-repository.js";

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

const ACTOR = User.create({
	id: "user-1",
	auth0Sub: "auth0|ana",
	email: "ana@x.com",
	fullName: "Ana",
});

/**
 * The use cases under test with the two in-memory adapters sharing one store:
 * the ledger applies the stock change to the same rows the product repository
 * serves, which is what makes the assertions about the resulting stock real.
 */
function build(options: { products?: Product[]; users?: User[] } = {}) {
	const store = new Map<string, Product>(
		(options.products ?? [product()]).map((row) => [row.id, row]),
	);
	const productRepository = new InMemoryProductRepository([], store);
	const stockMovementRepository = new InMemoryStockMovementRepository(store);
	const userRepository = createFakeUserRepository(options.users ?? [ACTOR]);

	return {
		store,
		productRepository,
		stockMovementRepository,
		userRepository,
		register: new RegisterStockMovementUseCase({
			productRepository,
			stockMovementRepository,
		}),
		list: new ListStockMovementsUseCase({
			stockMovementRepository,
			productRepository,
			userRepository,
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
			product: { id: PRODUCT, name: "Cafe molido 500g", sku: "CAF-500" },
			actor: { id: ACTOR.id, fullName: "Ana", email: "ana@x.com" },
		});
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
