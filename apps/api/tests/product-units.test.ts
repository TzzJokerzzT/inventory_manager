import { ListProductUnitsUseCase } from "../src/application/use-cases/list-product-units.js";
import { Product } from "../src/domain/entities/product.js";
import { StockLot } from "../src/domain/entities/stock-lot.js";
import { StockMovement } from "../src/domain/entities/stock-movement.js";
import { ProductNotFoundError } from "../src/domain/errors/product-not-found-error.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockLotRepository } from "../src/infrastructure/database/in-memory-stock-lot-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";

const COMPANY = "11111111-2222-4333-8444-555555555555";
const OTHER_COMPANY = "99999999-8888-4777-8666-555555555555";
const PRODUCT_ID = "22222222-3333-4444-8555-666666666666";
const OTHER_PRODUCT_ID = "33333333-4444-4555-8666-777777777777";
const LONELY_PRODUCT_ID = "44444444-5555-4666-8777-888888888888";
const SUPPLIER_ID = "55555555-6666-4777-8888-999999999999";
const USER_ID = "88888888-9999-4aaa-8bbb-cccccccccccc";

const OLDER = new Date("2026-10-01T09:00:00.000Z");
const NEWER = new Date("2026-10-05T09:00:00.000Z");

/**
 * The read F3a asks for (L23): which units a product has, so the sale screen can
 * offer the concrete units instead of only how many are left.
 *
 * Everything is observed through the use case and the public shape of its
 * answer; the ledger is only written to put a unit in the `SOLD` state, which is
 * the same write the sale performs.
 */
describe("ListProductUnitsUseCase", () => {
	function build() {
		const store = new Map<string, Product>();
		const productRepository = new InMemoryProductRepository([], store);
		const stockMovementRepository = new InMemoryStockMovementRepository(store);
		const stockLotRepository = new InMemoryStockLotRepository(
			stockMovementRepository,
		);

		productRepository.save(
			Product.create({
				id: PRODUCT_ID,
				companyId: COMPANY,
				name: "Rollo plastico",
				sku: "ROLLO",
				price: "9000.00",
			}),
		);
		productRepository.save(
			Product.create({
				id: OTHER_PRODUCT_ID,
				companyId: OTHER_COMPANY,
				name: "Rollo ajeno",
				sku: "AJENO",
				price: "9000.00",
			}),
		);
		productRepository.save(
			Product.create({
				id: LONELY_PRODUCT_ID,
				companyId: COMPANY,
				name: "Sin lotes",
				sku: "SINLOTES",
				price: "9000.00",
			}),
		);

		const useCase = new ListProductUnitsUseCase({
			productRepository,
			stockLotRepository,
		});

		async function seedLot(options: {
			id: string;
			receivedAt: Date;
			measures: number[];
			costPerMeasure: string;
			productId?: string;
			companyId?: string;
		}): Promise<StockLot> {
			const lot = StockLot.create({
				id: options.id,
				companyId: options.companyId ?? COMPANY,
				productId: options.productId ?? PRODUCT_ID,
				supplierId: SUPPLIER_ID,
				costPerMeasure: options.costPerMeasure,
				measures: options.measures,
				receivedAt: options.receivedAt,
				createdAt: options.receivedAt,
			});

			return stockLotRepository.register(lot, USER_ID);
		}

		/** The write a sale performs: the named units move to `SOLD`. */
		async function sell(unitIds: string[]): Promise<void> {
			const result = await stockMovementRepository.register(
				StockMovement.create({
					companyId: COMPANY,
					productId: PRODUCT_ID,
					type: "OUT",
					quantity: unitIds.length,
					unitPrice: "9000.00",
					unitIds,
					userId: USER_ID,
				}),
			);

			if (result.kind !== "registered") {
				throw new Error(`The seeded sale was rejected: ${result.kind}`);
			}
		}

		return { useCase, seedLot, sell };
	}

	it("answers only the AVAILABLE units by default", async () => {
		const { useCase, seedLot, sell } = build();
		const lot = await seedLot({
			id: "lot-a",
			receivedAt: OLDER,
			measures: [2, 4],
			costPerMeasure: "1000.00",
		});
		const [available, sold] = lot.units;
		if (available === undefined || sold === undefined) {
			throw new Error("The seeded lot has fewer units than expected");
		}
		await sell([sold.id]);

		const units = await useCase.execute(
			{ productId: PRODUCT_ID },
			{ companyId: COMPANY },
		);

		expect(units).toEqual([
			{
				id: available.id,
				code: "R-01",
				measure: "2.000",
				cost: "2000.00",
				status: "AVAILABLE",
				lotId: "lot-a",
				receivedAt: OLDER.toISOString(),
			},
		]);
	});

	it("answers only the SOLD units when the status is SOLD", async () => {
		const { useCase, seedLot, sell } = build();
		const lot = await seedLot({
			id: "lot-a",
			receivedAt: OLDER,
			measures: [2, 4],
			costPerMeasure: "1000.00",
		});
		const sold = lot.units[1];
		if (sold === undefined) {
			throw new Error("The seeded lot has no second unit");
		}
		await sell([sold.id]);

		const units = await useCase.execute(
			{ productId: PRODUCT_ID, status: "SOLD" },
			{ companyId: COMPANY },
		);

		expect(units).toEqual([
			{
				id: sold.id,
				code: "R-02",
				measure: "4.000",
				cost: "4000.00",
				status: "SOLD",
				lotId: "lot-a",
				receivedAt: OLDER.toISOString(),
			},
		]);
	});

	it("answers both states when the status is ALL", async () => {
		const { useCase, seedLot, sell } = build();
		const lot = await seedLot({
			id: "lot-a",
			receivedAt: OLDER,
			measures: [2, 4],
			costPerMeasure: "1000.00",
		});
		const sold = lot.units[1];
		if (sold === undefined) {
			throw new Error("The seeded lot has no second unit");
		}
		await sell([sold.id]);

		const units = await useCase.execute(
			{ productId: PRODUCT_ID, status: "ALL" },
			{ companyId: COMPANY },
		);

		expect(units.map((unit) => [unit.code, unit.status])).toEqual([
			["R-01", "AVAILABLE"],
			["R-02", "SOLD"],
		]);
	});

	it("orders the oldest lot first and then the units by code", async () => {
		const { useCase, seedLot } = build();
		// Registered newest first on purpose: the answer is ordered by the lot's
		// date, not by the order the lots were written.
		await seedLot({
			id: "lot-new",
			receivedAt: NEWER,
			measures: [3],
			costPerMeasure: "2000.00",
		});
		await seedLot({
			id: "lot-old",
			receivedAt: OLDER,
			measures: [1, 5],
			costPerMeasure: "1000.00",
		});

		const units = await useCase.execute(
			{ productId: PRODUCT_ID },
			{ companyId: COMPANY },
		);

		expect(units.map((unit) => `${unit.lotId}/${unit.code}`)).toEqual([
			"lot-old/R-01",
			"lot-old/R-02",
			"lot-new/R-01",
		]);
	});

	it("answers an empty array for a product without lots", async () => {
		const { useCase } = build();

		const units = await useCase.execute(
			{ productId: LONELY_PRODUCT_ID },
			{ companyId: COMPANY },
		);

		expect(units).toEqual([]);
	});

	it("answers product_not_found for a product of another company", async () => {
		const { useCase, seedLot } = build();
		await seedLot({
			id: "lot-foreign",
			receivedAt: OLDER,
			measures: [3],
			costPerMeasure: "1000.00",
			productId: OTHER_PRODUCT_ID,
			companyId: OTHER_COMPANY,
		});

		// Neither the id nor the units of the other company's product leak: the
		// answer is the same one a nonexistent id produces.
		const foreign = useCase.execute(
			{ productId: OTHER_PRODUCT_ID },
			{ companyId: COMPANY },
		);
		const missing = useCase.execute(
			{ productId: "99999999-9999-4999-8999-999999999999" },
			{ companyId: COMPANY },
		);

		await expect(foreign).rejects.toBeInstanceOf(ProductNotFoundError);
		await expect(missing).rejects.toBeInstanceOf(ProductNotFoundError);

		// And the product of the other company still answers with its own units.
		const ownUnits = await useCase.execute(
			{ productId: OTHER_PRODUCT_ID },
			{ companyId: OTHER_COMPANY },
		);
		expect(ownUnits).toHaveLength(1);
	});

	it("never answers a unit of another product", async () => {
		const { useCase, seedLot } = build();
		await seedLot({
			id: "lot-other",
			receivedAt: OLDER,
			measures: [7],
			costPerMeasure: "1000.00",
			productId: LONELY_PRODUCT_ID,
		});

		const units = await useCase.execute(
			{ productId: PRODUCT_ID },
			{ companyId: COMPANY },
		);

		expect(units).toEqual([]);
	});
});
