import type { Product } from "@/lib/api/schemas";
import { formatCents, inventoryValue, priceToCents } from "../inventory-value";

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
		stockQuantity: 2,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

describe("priceToCents", () => {
	it("reads the decimal string as integer cents", () => {
		// S4: la suma se hace en centavos enteros, nunca en floats.
		expect(priceToCents("1500.00")).toBe(150000);
	});

	it("pads a single decimal digit to cents", () => {
		expect(priceToCents("1500.5")).toBe(150050);
		expect(priceToCents("0.1")).toBe(10);
	});

	it("accepts a price with no decimals", () => {
		expect(priceToCents("1500")).toBe(150000);
	});

	it("keeps the cents of an amount below one unit", () => {
		// El borde de los dos decimales: "0.01" es un centavo, no cero.
		expect(priceToCents("0.01")).toBe(1);
		expect(priceToCents("0.10")).toBe(10);
	});

	it("keeps large values exact", () => {
		// Un precio grande no puede perder centavos al multiplicarse por el stock.
		expect(priceToCents("999999999999.99")).toBe(99999999999999);
	});

	it("returns 0 for a price the contract does not allow", () => {
		// Una fila malformada no puede tirar el gráfico entero.
		expect(priceToCents("mil quinientos")).toBe(0);
		expect(priceToCents("")).toBe(0);
		expect(priceToCents("1500.005")).toBe(0);
	});
});

describe("formatCents", () => {
	it("formats cents with the es-AR grouping and decimal separator", () => {
		expect(formatCents(123456)).toBe("$ 1.234,56");
	});

	it("pads the cents and the units", () => {
		expect(formatCents(0)).toBe("$ 0,00");
		expect(formatCents(5)).toBe("$ 0,05");
		expect(formatCents(150000)).toBe("$ 1.500,00");
	});

	it("groups thousands without a locale lookup", () => {
		// Determinístico: el mismo string en Node y en el navegador.
		expect(formatCents(999999999999)).toBe("$ 9.999.999.999,99");
	});
});

describe("inventoryValue", () => {
	it("multiplies price by stock and sums it in cents", () => {
		const value = inventoryValue([
			product({ id: "p1", price: "1500.00", stockQuantity: 2 }),
			product({ id: "p2", name: "Yerba 1kg", price: "0.10", stockQuantity: 3 }),
		]);

		// 2 × 150000 + 3 × 10 = 300030
		expect(value.totalCents).toBe(300030);
	});

	it("does not drift on a sum a float would round", () => {
		// 0.10 × 3 en floats da 0.30000000000000004; en centavos enteros, 30.
		const value = inventoryValue([
			product({ id: "p1", price: "0.10", stockQuantity: 1 }),
			product({ id: "p2", name: "Yerba 1kg", price: "0.20", stockQuantity: 1 }),
		]);

		expect(value.totalCents).toBe(30);
	});

	it("counts nothing for a product without stock", () => {
		const value = inventoryValue([
			product({ id: "p1", stockQuantity: 0 }),
			product({ id: "p2", name: "Yerba 1kg", stockQuantity: 3 }),
		]);

		expect(value.totalCents).toBe(450000);
		expect(value.topProducts.map((row) => row.id)).toEqual(["p2"]);
	});

	it("lists the products by value, highest first", () => {
		const value = inventoryValue([
			product({ id: "p1", name: "Café", price: "10.00", stockQuantity: 1 }),
			product({ id: "p2", name: "Yerba", price: "100.00", stockQuantity: 1 }),
			product({ id: "p3", name: "Azúcar", price: "50.00", stockQuantity: 1 }),
		]);

		expect(value.topProducts.map((row) => row.cents)).toEqual([
			10000, 5000, 1000,
		]);
	});

	it("breaks a tie by name so the order is stable", () => {
		const value = inventoryValue([
			product({ id: "p2", name: "Yerba", price: "100.00", stockQuantity: 1 }),
			product({ id: "p1", name: "Café", price: "100.00", stockQuantity: 1 }),
		]);

		expect(value.topProducts.map((row) => row.name)).toEqual(["Café", "Yerba"]);
	});

	it("carries the quantity each row is worth", () => {
		const value = inventoryValue([
			product({ id: "p1", price: "1500.00", stockQuantity: 2 }),
		]);

		expect(value.topProducts[0]).toEqual({
			id: "p1",
			name: "Café molido 500g",
			quantity: 2,
			cents: 300000,
		});
	});

	it("returns an empty total for a company with no products", () => {
		expect(inventoryValue([])).toEqual({ totalCents: 0, topProducts: [] });
	});
});
