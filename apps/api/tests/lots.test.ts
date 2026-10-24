import { RegisterLotUseCase } from "../src/application/use-cases/register-lot.js";
import type { MembershipRole } from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { Supplier } from "../src/domain/entities/supplier.js";
import { DomainError } from "../src/domain/errors/domain-error.js";
import { InsufficientRoleError } from "../src/domain/errors/insufficient-role-error.js";
import { ProductNotFoundError } from "../src/domain/errors/product-not-found-error.js";
import { SupplierNotFoundError } from "../src/domain/errors/supplier-not-found-error.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockLotRepository } from "../src/infrastructure/database/in-memory-stock-lot-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";
import { InMemorySupplierRepository } from "../src/infrastructure/database/in-memory-supplier-repository.js";

const COMPANY = "11111111-2222-4333-8444-555555555555";
const OTHER_COMPANY = "99999999-8888-4777-8666-555555555555";
const PRODUCT_ID = "22222222-3333-4444-8555-666666666666";
const OTHER_PRODUCT_ID = "33333333-4444-4555-8666-777777777777";
const SUPPLIER_ID = "44444444-5555-4666-8777-888888888888";
const OTHER_SUPPLIER_ID = "55555555-6666-4777-8888-999999999999";
const DELETED_SUPPLIER_ID = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const MISSING_ID = "77777777-8888-4999-8aaa-bbbbbbbbbbbb";
const ACTOR_ID = "88888888-9999-4aaa-8bbb-cccccccccccc";

interface Harness {
	useCase: RegisterLotUseCase;
	productRepository: InMemoryProductRepository;
	stockMovementRepository: InMemoryStockMovementRepository;
	stockLotRepository: InMemoryStockLotRepository;
	store: Map<string, Product>;
}

/**
 * The suites share the in-memory stores exactly like the endpoint ones: the
 * ledger, the products and the lots have to read the same state, which is what
 * the database is in production.
 */
function harness(): Harness {
	const store = new Map<string, Product>();
	const productRepository = new InMemoryProductRepository([], store);
	const stockMovementRepository = new InMemoryStockMovementRepository(store);
	const stockLotRepository = new InMemoryStockLotRepository(
		stockMovementRepository,
	);
	const supplierRepository = new InMemorySupplierRepository();

	productRepository.save(
		Product.create({
			id: PRODUCT_ID,
			companyId: COMPANY,
			name: "Rollo plastico",
			sku: "ROLLO",
			price: "9000",
		}),
	);
	productRepository.save(
		Product.create({
			id: OTHER_PRODUCT_ID,
			companyId: OTHER_COMPANY,
			name: "Rollo ajeno",
			sku: "AJENO",
			price: "9000",
		}),
	);
	supplierRepository.save(
		Supplier.create({
			id: SUPPLIER_ID,
			companyId: COMPANY,
			name: "Distribuidora Sur",
		}),
	);
	supplierRepository.save(
		Supplier.create({
			id: OTHER_SUPPLIER_ID,
			companyId: OTHER_COMPANY,
			name: "Distribuidora Ajena",
		}),
	);
	supplierRepository.save(
		Supplier.create({
			id: DELETED_SUPPLIER_ID,
			companyId: COMPANY,
			name: "Distribuidora Borrada",
			deletedAt: new Date("2026-10-20T12:00:00.000Z"),
		}),
	);

	return {
		useCase: new RegisterLotUseCase({
			productRepository,
			supplierRepository,
			stockLotRepository,
		}),
		productRepository,
		stockMovementRepository,
		stockLotRepository,
		store,
	};
}

function context(actorRole: MembershipRole = "OWNER") {
	return { companyId: COMPANY, actorRole, actorId: ACTOR_ID };
}

function input(overrides: Record<string, unknown> = {}) {
	return {
		productId: PRODUCT_ID,
		supplierId: SUPPLIER_ID,
		costPerMeasure: "5900",
		measures: [12.5, 10, 7.5],
		...overrides,
	};
}

describe("RegisterLotUseCase", () => {
	it.each<MembershipRole>(["OWNER", "ADMIN"])(
		"registers the lot as a %s, because writing is `manage_products`",
		async (actorRole) => {
			const { useCase, stockLotRepository } = harness();

			const lot = await useCase.execute(input(), context(actorRole));

			expect(lot.unitCount).toBe(3);
			expect(lot.measureTotal).toBe("30.000");
			expect(stockLotRepository.listByCompany(COMPANY)).toEqual([lot]);
		},
	);

	it("rejects a MEMBER and persists nothing", async () => {
		// S3/S6: a MEMBER reads the catalogue; a purchase is a catalogue write.
		const { useCase, stockLotRepository, stockMovementRepository, store } =
			harness();

		await expect(useCase.execute(input(), context("MEMBER"))).rejects.toThrow(
			InsufficientRoleError,
		);

		expect(stockLotRepository.listByCompany(COMPANY)).toEqual([]);
		expect(
			await stockMovementRepository.findByCompany(COMPANY, { limit: 10 }),
		).toEqual([]);
		expect(store.get(PRODUCT_ID)?.stockQuantity).toBe(0);
	});

	it.each([
		["another company's product", OTHER_PRODUCT_ID],
		["a product that does not exist", MISSING_ID],
	])("answers product_not_found for %s", async (_label, productId) => {
		const { useCase, stockLotRepository, store } = harness();

		await expect(
			useCase.execute(input({ productId }), context()),
		).rejects.toThrow(ProductNotFoundError);

		expect(stockLotRepository.listByCompany(COMPANY)).toEqual([]);
		expect(store.get(PRODUCT_ID)?.stockQuantity).toBe(0);
	});

	it.each([
		["an inactive supplier", DELETED_SUPPLIER_ID],
		["another company's supplier", OTHER_SUPPLIER_ID],
		["a supplier that does not exist", MISSING_ID],
	])("answers supplier_not_found for %s", async (_label, supplierId) => {
		const { useCase, stockLotRepository, stockMovementRepository } = harness();

		await expect(
			useCase.execute(input({ supplierId }), context()),
		).rejects.toThrow(SupplierNotFoundError);

		expect(stockLotRepository.listByCompany(COMPANY)).toEqual([]);
		expect(
			await stockMovementRepository.findByCompany(COMPANY, { limit: 10 }),
		).toEqual([]);
	});

	it("records the lot, its units, one IN movement and the stock increment (S6, S8)", async () => {
		const { useCase, stockMovementRepository, store } = harness();

		const lot = await useCase.execute(input(), context());

		expect(lot.units).toHaveLength(3);

		const movements = await stockMovementRepository.findByCompany(COMPANY, {
			limit: 10,
		});

		// S7: the stock keeps counting whole units, so the movement's quantity is
		// the number of rolls, never the weight.
		expect(movements).toHaveLength(1);
		expect(movements[0]).toMatchObject({
			companyId: COMPANY,
			productId: PRODUCT_ID,
			type: "IN",
			quantity: 3,
			lotId: lot.id,
			userId: ACTOR_ID,
		});

		// S8: the ledger and the AVAILABLE units agree from the first lot.
		expect(store.get(PRODUCT_ID)?.stockQuantity).toBe(3);
		expect(
			lot.units.filter((unit) => unit.status === "AVAILABLE"),
		).toHaveLength(3);
	});

	it("rejects an invalid body through the entity and persists nothing", async () => {
		const { useCase, stockLotRepository, store } = harness();

		await expect(
			useCase.execute(input({ measures: [] }), context()),
		).rejects.toThrow(DomainError);

		expect(stockLotRepository.listByCompany(COMPANY)).toEqual([]);
		expect(store.get(PRODUCT_ID)?.stockQuantity).toBe(0);
	});

	it("never takes a measureTotal from the input: the total is derived", async () => {
		// The edge rejects a `measureTotal` in the body (400
		// `measure_total_derived`); this pins the deeper rule, that the value is
		// never read even when it reaches the use case.
		const { useCase } = harness();

		const lot = await useCase.execute(
			{ ...input(), measureTotal: "999.000" } as never,
			context(),
		);

		expect(lot.measureTotal).toBe("30.000");
	});
});
