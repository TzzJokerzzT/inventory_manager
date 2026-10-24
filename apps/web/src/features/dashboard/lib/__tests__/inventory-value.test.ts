import type { ProductListItem } from "@/lib/api/schemas";
import { formatCents, inventoryValue, priceToCents } from "../inventory-value";

/**
 * One catalogue row. The defaults describe a product with a known cost, so a
 * test that only cares about the money can pass `unitCost`/`marginPerUnit` and
 * nothing else; the listed `price` is deliberately far from the cost, because
 * the dashboard must never use it as one (L27).
 */
function product(overrides: Partial<ProductListItem> = {}): ProductListItem {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		measureUnit: "KILOGRAM",
		availableUnits: 2,
		availableMeasure: "2.000",
		costPerMeasure: "1000.000",
		unitCost: "1000.00",
		marginPerUnit: "500.00",
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

	it("keeps the sign of a negative amount", () => {
		// L27: el margen por unidad puede ser negativo (se vende bajo el costo),
		// así que la lectura del contrato no puede perder el signo.
		expect(priceToCents("-20500.00")).toBe(-2050000);
		expect(priceToCents("-0.10")).toBe(-10);
		expect(priceToCents("-1500")).toBe(-150000);
	});

	it("returns 0 for a price the contract does not allow", () => {
		// Una fila malformada no puede tirar el gráfico entero.
		expect(priceToCents("mil quinientos")).toBe(0);
		expect(priceToCents("")).toBe(0);
		expect(priceToCents("1500.005")).toBe(0);
		// El signo sólo vale pegado a los dígitos, y sólo el menos.
		expect(priceToCents("- 1500")).toBe(0);
		expect(priceToCents("+1500.00")).toBe(0);
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

	it("renders a negative amount with its sign", () => {
		// L27: el margen potencial negativo tiene que poder decirse.
		expect(formatCents(-150000)).toBe("-$ 1.500,00");
		expect(formatCents(-5)).toBe("-$ 0,05");
	});
});

describe("inventoryValue", () => {
	it("values the stock at cost, not at the listed price", () => {
		// L27: Σ (unitCost × stockQuantity). El precio de lista (1500,00 en el
		// fixture) no entra en la cuenta por ningún lado.
		const value = inventoryValue([
			product({ id: "p1", price: "9999.00", unitCost: "1500.00" }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				price: "9999.00",
				unitCost: "0.10",
				stockQuantity: 3,
			}),
		]);

		// 2 × 150000 + 3 × 10 = 300030
		expect(value.totalCents).toBe(300030);
	});

	it("does not drift on a sum a float would round", () => {
		// 0.10 + 0.20 en floats da 0.30000000000000004; en centavos enteros, 30.
		const value = inventoryValue([
			product({ id: "p1", unitCost: "0.10", stockQuantity: 1 }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				unitCost: "0.20",
				stockQuantity: 1,
			}),
		]);

		expect(value.totalCents).toBe(30);
	});

	it("counts nothing for a product without stock", () => {
		const value = inventoryValue([
			product({
				id: "p1",
				stockQuantity: 0,
				unitCost: null,
				marginPerUnit: null,
			}),
			product({ id: "p2", name: "Yerba 1kg", stockQuantity: 3 }),
		]);

		expect(value.totalCents).toBe(300000);
		expect(value.topProducts.map((row) => row.id)).toEqual(["p2"]);
	});

	it("leaves a product with no known cost out and counts it apart", () => {
		// L27: sin costo no es cero. No aporta al valor ni al margen, y se informa.
		const value = inventoryValue([
			product({ id: "p1", unitCost: "1000.00" }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				stockQuantity: 3,
				unitCost: null,
				marginPerUnit: null,
				availableUnits: 0,
				availableMeasure: "0.000",
				costPerMeasure: null,
			}),
		]);

		expect(value.totalCents).toBe(200000);
		expect(value.marginPotentialCents).toBe(100000);
		expect(value.productsWithoutCost).toBe(1);
		expect(value.topProducts.map((row) => row.id)).toEqual(["p1"]);
	});

	it("does not report a sold-out product as one without a known cost", () => {
		// Vendido no es "sin costo": no hay stock del que hablar.
		const value = inventoryValue([
			product({
				id: "p1",
				stockQuantity: 0,
				unitCost: null,
				marginPerUnit: null,
			}),
			product({ id: "p2", name: "Yerba 1kg", stockQuantity: 3 }),
		]);

		expect(value.productsWithoutCost).toBe(0);
	});

	it("reports zero value and the whole catalogue as unknown when nothing has a cost", () => {
		// L11: la empresa sin lotes no tiene un inventario que valga cero; tiene un
		// costo desconocido, y eso es lo que se informa.
		const value = inventoryValue([
			product({ id: "p1", unitCost: null, marginPerUnit: null }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				unitCost: null,
				marginPerUnit: null,
			}),
		]);

		expect(value.totalCents).toBe(0);
		expect(value.marginPotentialCents).toBe(0);
		expect(value.productsWithoutCost).toBe(2);
		expect(value.topProducts).toEqual([]);
	});

	it("sums the potential margin over the same subset", () => {
		const value = inventoryValue([
			product({ id: "p1", marginPerUnit: "500.00", stockQuantity: 2 }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				marginPerUnit: "100.00",
				stockQuantity: 3,
			}),
		]);

		// 2 × 50000 + 3 × 10000 = 130000
		expect(value.marginPotentialCents).toBe(130000);
	});

	it("keeps a negative potential margin negative", () => {
		// L27: vender bajo el costo es una situación real y el número lo dice.
		const value = inventoryValue([
			product({ id: "p1", marginPerUnit: "500.00", stockQuantity: 2 }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				marginPerUnit: "-20500.00",
				stockQuantity: 1,
			}),
		]);

		// 2 × 50000 + 1 × −2050000 = −1950000
		expect(value.marginPotentialCents).toBe(-1950000);
	});

	it("lists the products by cost value, highest first", () => {
		const value = inventoryValue([
			product({ id: "p1", name: "Café", unitCost: "10.00", stockQuantity: 1 }),
			product({
				id: "p2",
				name: "Yerba",
				unitCost: "100.00",
				stockQuantity: 1,
			}),
			product({
				id: "p3",
				name: "Azúcar",
				unitCost: "50.00",
				stockQuantity: 1,
			}),
		]);

		expect(value.topProducts.map((row) => row.cents)).toEqual([
			10000, 5000, 1000,
		]);
	});

	it("breaks a tie by name so the order is stable", () => {
		const value = inventoryValue([
			product({
				id: "p2",
				name: "Yerba",
				unitCost: "100.00",
				stockQuantity: 1,
			}),
			product({ id: "p1", name: "Café", unitCost: "100.00", stockQuantity: 1 }),
		]);

		expect(value.topProducts.map((row) => row.name)).toEqual(["Café", "Yerba"]);
	});

	it("carries the quantity each row is worth", () => {
		const value = inventoryValue([
			product({ id: "p1", unitCost: "1500.00", stockQuantity: 2 }),
		]);

		expect(value.topProducts[0]).toEqual({
			id: "p1",
			name: "Café molido 500g",
			quantity: 2,
			cents: 300000,
		});
	});

	it("returns an empty total for a company with no products", () => {
		expect(inventoryValue([])).toEqual({
			totalCents: 0,
			marginPotentialCents: 0,
			productsWithoutCost: 0,
			topProducts: [],
		});
	});
});
