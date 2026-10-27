import { GetProductUseCase } from "../src/application/use-cases/get-product.js";
import { ListProductsUseCase } from "../src/application/use-cases/list-products.js";
import { ListStockMovementsUseCase } from "../src/application/use-cases/list-stock-movements.js";
import { ListSuppliersUseCase } from "../src/application/use-cases/list-suppliers.js";
import { LotUnit } from "../src/domain/entities/lot-unit.js";
import { Product } from "../src/domain/entities/product.js";
import { StockLot } from "../src/domain/entities/stock-lot.js";
import { StockMovement } from "../src/domain/entities/stock-movement.js";
import { Supplier } from "../src/domain/entities/supplier.js";
import { InMemoryCategoryRepository } from "../src/infrastructure/database/in-memory-category-repository.js";
import { InMemoryCustomerRepository } from "../src/infrastructure/database/in-memory-customer-repository.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockLotRepository } from "../src/infrastructure/database/in-memory-stock-lot-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";
import { InMemorySupplierRepository } from "../src/infrastructure/database/in-memory-supplier-repository.js";
import { createFakeUserRepository } from "./support/fake-user-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";
const PRODUCT = "product-1";
const OTHER_PRODUCT = "product-2";
const SUPPLIER_A = "supplier-a";
const SUPPLIER_B = "supplier-b";
const SUPPLIER_WITHOUT_LOTS = "supplier-z";
const USER_ID = "user-1";

const T1 = new Date("2026-10-02T10:00:00.000Z");
const T2 = new Date("2026-10-03T10:00:00.000Z");
const T3 = new Date("2026-10-04T10:00:00.000Z");

function build() {
	const store = new Map<string, Product>();
	const productRepository = new InMemoryProductRepository([], store);
	const stockMovementRepository = new InMemoryStockMovementRepository(store);
	const stockLotRepository = new InMemoryStockLotRepository(
		stockMovementRepository,
	);
	const supplierRepository = new InMemorySupplierRepository();

	const product = Product.create({
		id: PRODUCT,
		companyId: COMPANY,
		name: "Rollo plastico",
		sku: "ROLLO",
		price: "9000.00",
		stockQuantity: 10,
	});
	productRepository.save(product);

	return {
		productRepository,
		stockMovementRepository,
		stockLotRepository,
		supplierRepository,
		product,
	};
}

function seedSupplier(
	repository: InMemorySupplierRepository,
	id: string,
	name: string,
	companyId: string = COMPANY,
): Supplier {
	const supplier = Supplier.create({ id, companyId, name });
	repository.save(supplier);

	return supplier;
}

function seedProduct(
	repository: InMemoryProductRepository,
	options: {
		id: string;
		name: string;
		price: string;
		companyId?: string;
		measureUnit?: "KILOGRAM" | "LITRE" | "METRE";
	},
): Product {
	const product = Product.create({
		id: options.id,
		companyId: options.companyId ?? COMPANY,
		name: options.name,
		sku: options.id.toUpperCase(),
		price: options.price,
		measureUnit: options.measureUnit,
	});
	repository.save(product);

	return product;
}

interface SeedLotOptions {
	id: string;
	productId?: string;
	supplierId: string;
	companyId?: string;
	costPerMeasure: string;
	measures: number[];
	/** The business date of the delivery; `createdAt` follows it. */
	receivedAt: Date;
}

/**
 * Registers a purchase lot the way the API does: through the lot repository,
 * which also writes the `IN` movement and the stock. That is what makes the
 * units real for the reads below.
 */
async function seedLot(
	lots: InMemoryStockLotRepository,
	options: SeedLotOptions,
): Promise<StockLot> {
	const lot = StockLot.create({
		id: options.id,
		companyId: options.companyId ?? COMPANY,
		productId: options.productId ?? PRODUCT,
		supplierId: options.supplierId,
		costPerMeasure: options.costPerMeasure,
		measures: options.measures,
		receivedAt: options.receivedAt,
		createdAt: options.receivedAt,
	});

	return lots.register(lot, USER_ID);
}

function context() {
	return { companyId: COMPANY };
}

function buildMovementReads() {
	const {
		productRepository,
		stockMovementRepository,
		stockLotRepository,
		supplierRepository,
	} = build();

	return {
		list: new ListStockMovementsUseCase({
			stockMovementRepository,
			productRepository,
			userRepository: createFakeUserRepository(),
			customerRepository: new InMemoryCustomerRepository(),
		}),
		stockMovementRepository,
		stockLotRepository,
		supplierRepository,
	};
}

/** The id of the `index`-th unit of a lot, which the domain generates. */
function unitId(lot: StockLot, index: number): string {
	const value = lot.units[index];

	if (value === undefined) {
		throw new Error(`Lot ${lot.id} has no unit at ${index}`);
	}

	return value.id;
}

function unit(id: string, measure: string, cost: string): LotUnit {
	return LotUnit.create({
		id,
		lotId: "lot-1",
		code: id,
		measure,
		cost,
	});
}

describe("movement margin (L11)", () => {
	it("subtracts the cost of the units from the income of the whole sale", async () => {
		const { list, stockMovementRepository } = buildMovementReads();

		stockMovementRepository.saveUnits([
			{
				unit: unit("u-1", "1.500", "1200.50"),
				companyId: COMPANY,
				productId: PRODUCT,
			},
			{
				unit: unit("u-2", "2.000", "1100.00"),
				companyId: COMPANY,
				productId: PRODUCT,
			},
			{
				unit: unit("u-3", "1.250", "900.75"),
				companyId: COMPANY,
				productId: PRODUCT,
			},
		]);

		const registered = await stockMovementRepository.register(
			StockMovement.create({
				companyId: COMPANY,
				productId: PRODUCT,
				type: "OUT",
				quantity: 3,
				unitPrice: "2500.00",
				unitIds: ["u-1", "u-2", "u-3"],
				userId: USER_ID,
			}),
		);

		expect(registered.kind).toBe("registered");

		const [sale] = await list.execute({ limit: 10 }, context());

		// 3 × 2500.00 = 7500.00 of income against 3201.25 of cost.
		expect(sale?.margin).toBe("4298.75");
		expect(sale?.unitPrice).toBe("2500.00");
		expect(sale?.units).toHaveLength(3);
	});

	it("keeps the cents of the costs exact", async () => {
		const { list, stockMovementRepository } = buildMovementReads();

		stockMovementRepository.saveUnits([
			{
				unit: unit("u-1", "1.000", "1234.56"),
				companyId: COMPANY,
				productId: PRODUCT,
			},
			{
				unit: unit("u-2", "1.000", "2345.67"),
				companyId: COMPANY,
				productId: PRODUCT,
			},
		]);

		await stockMovementRepository.register(
			StockMovement.create({
				companyId: COMPANY,
				productId: PRODUCT,
				type: "OUT",
				quantity: 2,
				unitPrice: "2500.05",
				unitIds: ["u-1", "u-2"],
				userId: USER_ID,
			}),
		);

		const [sale] = await list.execute({ limit: 10 }, context());

		// 5000.10 - 3580.23 = 1419.87, with no float in the middle.
		expect(sale?.margin).toBe("1419.87");
	});

	it("answers null for a sale recorded before the price existed (S9)", async () => {
		const { list, stockMovementRepository } = buildMovementReads();

		// A legacy sale: no price and no units, because neither existed.
		stockMovementRepository.save(
			StockMovement.create({
				id: "legacy-sale",
				companyId: COMPANY,
				productId: PRODUCT,
				type: "OUT",
				quantity: 2,
				userId: USER_ID,
			}),
		);

		const [sale] = await list.execute({ limit: 10 }, context());

		expect(sale?.margin).toBeNull();
		expect(sale?.unitPrice).toBeNull();
	});

	it("answers null for a sale of a product that never came in a lot", async () => {
		const { list, stockMovementRepository } = buildMovementReads();

		// A product without units may still record a price (L9), but without
		// units there is no cost to subtract, so the margin stays unknown.
		stockMovementRepository.save(
			StockMovement.create({
				id: "unitless-sale",
				companyId: COMPANY,
				productId: PRODUCT,
				type: "OUT",
				quantity: 2,
				unitPrice: "2500.00",
				userId: USER_ID,
			}),
		);

		const [sale] = await list.execute({ limit: 10 }, context());

		expect(sale?.margin).toBeNull();
		expect(sale?.unitPrice).toBe("2500.00");
	});

	it("answers null for an entry", async () => {
		const { list, stockMovementRepository } = buildMovementReads();

		await stockMovementRepository.register(
			StockMovement.create({
				companyId: COMPANY,
				productId: PRODUCT,
				type: "IN",
				quantity: 5,
				userId: USER_ID,
			}),
		);

		const [entry] = await list.execute({ limit: 10 }, context());

		expect(entry?.type).toBe("IN");
		expect(entry?.margin).toBeNull();
	});
});

describe("product costs derived from the available units (L12)", () => {
	function productReads() {
		const {
			productRepository,
			stockLotRepository,
			stockMovementRepository,
			supplierRepository,
		} = build();

		return {
			get: new GetProductUseCase({
				productRepository,
				stockLotRepository,
				supplierRepository,
				categoryRepository: new InMemoryCategoryRepository(productRepository),
			}),
			list: new ListProductsUseCase({
				productRepository,
				stockLotRepository,
				categoryRepository: new InMemoryCategoryRepository(productRepository),
			}),
			stockMovementRepository,
			stockLotRepository,
			supplierRepository,
		};
	}

	it("only counts the units that are still AVAILABLE", async () => {
		const {
			get,
			stockMovementRepository,
			stockLotRepository,
			supplierRepository,
		} = productReads();
		seedSupplier(supplierRepository, SUPPLIER_A, "Distribuidora Sur");
		seedSupplier(supplierRepository, SUPPLIER_B, "Plasticos Norte");

		// Two lots of the same product at different prices per measure.
		const firstLot = await seedLot(stockLotRepository, {
			id: "lot-1",
			supplierId: SUPPLIER_A,
			costPerMeasure: "100.00",
			measures: [1.5, 2.5],
			receivedAt: T1,
		});
		const secondLot = await seedLot(stockLotRepository, {
			id: "lot-2",
			supplierId: SUPPLIER_B,
			costPerMeasure: "200.00",
			measures: [3],
			receivedAt: T2,
		});

		// One roll of each lot leaves: only `R-01` of lot 1 (1.500 kg, 150.00)
		// remains available.
		const sale = await stockMovementRepository.register(
			StockMovement.create({
				companyId: COMPANY,
				productId: PRODUCT,
				type: "OUT",
				quantity: 2,
				unitPrice: "1000.00",
				unitIds: [unitId(firstLot, 1), unitId(secondLot, 0)],
				userId: USER_ID,
			}),
		);
		expect(sale.kind).toBe("registered");

		const read = await get.execute({ productId: PRODUCT }, context());

		expect(read.availableUnits).toBe(1);
		// 1.500 kg for 150.00: the sold rolls contribute neither measure nor cost.
		expect(read.availableMeasure).toBe("1.500");
		expect(read.costPerMeasure).toBe("100.00");
		expect(read.unitCost).toBe("150.00");
		// The margin follows the listed price of the product.
		expect(read.marginPerUnit).toBe("8850.00");
	});

	it("answers null costs, but still answers, when no unit is available", async () => {
		const { get, list, supplierRepository } = productReads();
		seedSupplier(supplierRepository, SUPPLIER_A, "Distribuidora Sur");

		const read = await get.execute({ productId: PRODUCT }, context());
		expect(read).toMatchObject({
			id: PRODUCT,
			availableUnits: 0,
			availableMeasure: "0.000",
			costPerMeasure: null,
			unitCost: null,
			marginPerUnit: null,
			lots: [],
		});

		const [row] = await list.execute({}, context());
		expect(row).toMatchObject({
			id: PRODUCT,
			availableUnits: 0,
			costPerMeasure: null,
			unitCost: null,
			marginPerUnit: null,
		});
		// The list has no lots: 50 lots per catalogue row is another feature.
		expect(row).not.toHaveProperty("lots");
	});
});

describe("product lots (L12)", () => {
	function productReads() {
		const { productRepository, stockLotRepository, supplierRepository } =
			build();

		return {
			get: new GetProductUseCase({
				productRepository,
				stockLotRepository,
				supplierRepository,
				categoryRepository: new InMemoryCategoryRepository(productRepository),
			}),
			stockLotRepository,
			supplierRepository,
		};
	}

	it("lists the latest lots newest first with their supplier", async () => {
		const { get, stockLotRepository, supplierRepository } = productReads();
		seedSupplier(supplierRepository, SUPPLIER_A, "Distribuidora Sur");
		seedSupplier(supplierRepository, SUPPLIER_B, "Plasticos Norte");

		await seedLot(stockLotRepository, {
			id: "lot-old",
			supplierId: SUPPLIER_A,
			costPerMeasure: "5650.00",
			measures: [1, 2],
			receivedAt: T1,
		});
		await seedLot(stockLotRepository, {
			id: "lot-new",
			supplierId: SUPPLIER_B,
			costPerMeasure: "5900.00",
			measures: [1.5],
			receivedAt: T3,
		});

		const read = await get.execute({ productId: PRODUCT }, context());

		expect(read.lots.map((lot) => lot.id)).toEqual(["lot-new", "lot-old"]);
		expect(read.lots[0]).toEqual({
			id: "lot-new",
			supplierId: SUPPLIER_B,
			supplierName: "Plasticos Norte",
			receivedAt: T3.toISOString(),
			measureTotal: "1.500",
			costPerMeasure: "5900.00",
			unitCount: 1,
			availableUnits: 1,
		});
	});

	it("caps the answer at the latest 50 lots", async () => {
		const { get, stockLotRepository, supplierRepository } = productReads();
		seedSupplier(supplierRepository, SUPPLIER_A, "Distribuidora Sur");

		for (let index = 0; index < 51; index += 1) {
			await seedLot(stockLotRepository, {
				id: `lot-${String(index).padStart(2, "0")}`,
				supplierId: SUPPLIER_A,
				costPerMeasure: "100.00",
				measures: [1],
				receivedAt: new Date(T1.getTime() + index * 60_000),
			});
		}

		const read = await get.execute({ productId: PRODUCT }, context());

		expect(read.lots).toHaveLength(50);
		// The oldest one is the one left out.
		expect(read.lots[0]?.id).toBe("lot-50");
		expect(read.lots.map((lot) => lot.id)).not.toContain("lot-00");
	});

	it("answers an empty array for a product without lots", async () => {
		const { get } = productReads();

		const read = await get.execute({ productId: PRODUCT }, context());

		expect(read.lots).toEqual([]);
	});
});

describe("supplier last lot (L12)", () => {
	function supplierReads() {
		const { productRepository, stockLotRepository, supplierRepository } =
			build();

		return {
			list: new ListSuppliersUseCase({
				supplierRepository,
				stockLotRepository,
				productRepository,
			}),
			productRepository,
			stockLotRepository,
			supplierRepository,
		};
	}

	it("summarizes each supplier with its most recent lot", async () => {
		const { list, stockLotRepository, supplierRepository } = supplierReads();
		seedSupplier(supplierRepository, SUPPLIER_A, "Distribuidora Sur");
		seedSupplier(supplierRepository, SUPPLIER_B, "Plasticos Norte");
		seedSupplier(supplierRepository, SUPPLIER_WITHOUT_LOTS, "Sin compras");

		await seedLot(stockLotRepository, {
			id: "lot-a-old",
			supplierId: SUPPLIER_A,
			costPerMeasure: "5650.00",
			measures: [2],
			receivedAt: T1,
		});
		await seedLot(stockLotRepository, {
			id: "lot-a-new",
			supplierId: SUPPLIER_A,
			costPerMeasure: "5900.00",
			measures: [2],
			receivedAt: T3,
		});
		await seedLot(stockLotRepository, {
			id: "lot-b",
			supplierId: SUPPLIER_B,
			costPerMeasure: "6000.00",
			measures: [2],
			receivedAt: T2,
		});

		const suppliers = await list.execute(context());
		const byId = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

		expect(byId.get(SUPPLIER_A)?.lastLot).toEqual({
			id: "lot-a-new",
			productId: PRODUCT,
			productName: "Rollo plastico",
			costPerMeasure: "5900.00",
			measureUnit: "KILOGRAM",
			receivedAt: T3.toISOString(),
		});
		expect(byId.get(SUPPLIER_B)?.lastLot?.id).toBe("lot-b");
		// A supplier the company never bought from answers null, not a guess.
		expect(byId.get(SUPPLIER_WITHOUT_LOTS)?.lastLot).toBeNull();
	});

	it("scopes the last lot to the company it is read from", async () => {
		const { list, productRepository, stockLotRepository, supplierRepository } =
			supplierReads();
		seedSupplier(supplierRepository, SUPPLIER_A, "Distribuidora Sur");

		await seedLot(stockLotRepository, {
			id: "lot-own",
			supplierId: SUPPLIER_A,
			costPerMeasure: "5650.00",
			measures: [2],
			receivedAt: T1,
		});
		// A row of another company that names the same supplier: the company is
		// part of the query, so it can never be the answer of this roster.
		seedProduct(productRepository, {
			id: OTHER_PRODUCT,
			name: "Rollo ajeno",
			price: "9000.00",
			companyId: OTHER_COMPANY,
		});
		await seedLot(stockLotRepository, {
			id: "lot-foreign",
			productId: OTHER_PRODUCT,
			companyId: OTHER_COMPANY,
			supplierId: SUPPLIER_A,
			costPerMeasure: "1.00",
			measures: [2],
			receivedAt: T3,
		});

		const [supplier] = await list.execute(context());

		expect(supplier?.lastLot?.id).toBe("lot-own");
	});

	it("names the measure unit of the product that was bought", async () => {
		const { list, productRepository, stockLotRepository, supplierRepository } =
			supplierReads();
		seedSupplier(supplierRepository, SUPPLIER_A, "Distribuidora Sur");

		// The lot is for a product the harness does not know yet, so it is
		// seeded through the product store the read already uses.
		seedProduct(productRepository, {
			id: OTHER_PRODUCT,
			name: "Pintura",
			price: "500.00",
			measureUnit: "LITRE",
		});

		await seedLot(stockLotRepository, {
			id: "lot-paint",
			productId: OTHER_PRODUCT,
			supplierId: SUPPLIER_A,
			costPerMeasure: "350.00",
			measures: [10],
			receivedAt: T1,
		});

		const [supplier] = await list.execute(context());

		expect(supplier?.lastLot).toMatchObject({
			productName: "Pintura",
			measureUnit: "LITRE",
			costPerMeasure: "350.00",
		});
	});
});
