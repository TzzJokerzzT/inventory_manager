import type { Product } from "@/lib/api/schemas";
import { stockStatusCounts, stockStatusFor } from "../stock-status";

function product(overrides: Partial<Product> = {}): Product {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		measureUnit: "KILOGRAM",
		photoUrl: null,
		stockQuantity: 1,
		lowStockThreshold: 0,
		categoryId: null,
		categoryName: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

describe("stockStatusCounts", () => {
	it("counts the products with stock and the ones that ran out", () => {
		const counts = stockStatusCounts([
			product({ id: "p1", stockQuantity: 0 }),
			product({ id: "p2", stockQuantity: 8 }),
			product({ id: "p3", stockQuantity: 1 }),
		]);

		expect(counts).toEqual({ outOfStock: 1, inStock: 2 });
	});

	it("counts a single unit as in stock", () => {
		// S2: el corte es stock 0 contra stock > 0, no el umbral de stock bajo.
		expect(stockStatusCounts([product({ stockQuantity: 1 })]).inStock).toBe(1);
	});

	it("counts every product as out of stock when none has units", () => {
		expect(
			stockStatusCounts([
				product({ id: "p1", stockQuantity: 0 }),
				product({ id: "p2", stockQuantity: 0 }),
			]),
		).toEqual({ outOfStock: 2, inStock: 0 });
	});

	it("returns zeros for a company with no products", () => {
		expect(stockStatusCounts([])).toEqual({ outOfStock: 0, inStock: 0 });
	});
});

describe("stockStatusFor", () => {
	it("marks a product without units as out of stock", () => {
		// S3: agotado gana sobre stock bajo, aunque el umbral sea 0.
		expect(
			stockStatusFor(product({ stockQuantity: 0, lowStockThreshold: 0 })),
		).toBe("out_of_stock");
	});

	it("marks a product with units up to its threshold as low stock", () => {
		expect(
			stockStatusFor(product({ stockQuantity: 2, lowStockThreshold: 3 })),
		).toBe("low_stock");
		expect(
			stockStatusFor(product({ stockQuantity: 3, lowStockThreshold: 3 })),
		).toBe("low_stock");
	});

	it("marks a product above its threshold as in stock", () => {
		expect(
			stockStatusFor(product({ stockQuantity: 4, lowStockThreshold: 3 })),
		).toBe("in_stock");
		expect(
			stockStatusFor(product({ stockQuantity: 5, lowStockThreshold: 0 })),
		).toBe("in_stock");
	});
});
