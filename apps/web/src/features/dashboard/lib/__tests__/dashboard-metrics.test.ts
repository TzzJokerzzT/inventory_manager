import type { MovementTrendPoint, ProductListItem } from "@/lib/api/schemas";
import { dashboardMetrics } from "../dashboard-metrics";

/** One catalogue row with a known cost, so the money has a real source. */
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
		categoryName: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

/** A product with stock but no lots: no cost, no margin (L11). */
function uncosted(overrides: Partial<ProductListItem> = {}): ProductListItem {
	return product({
		availableUnits: 0,
		availableMeasure: "0.000",
		costPerMeasure: null,
		unitCost: null,
		marginPerUnit: null,
		...overrides,
	});
}

function point(
	date: string,
	entries: number,
	exits: number,
): MovementTrendPoint {
	return { date, entries, exits };
}

describe("dashboardMetrics", () => {
	it("counts nothing for an empty catalogue and an empty series", () => {
		// S2: la empresa sin catálogo no puede inventar números.
		expect(dashboardMetrics([], [])).toEqual({
			totalProducts: 0,
			inventoryValueCents: 0,
			marginPotentialCents: 0,
			productsWithoutCost: 0,
			criticalCount: 0,
			outOfStockCount: 0,
			lowStockOnlyCount: 0,
			unitsToday: 0,
			criticalProducts: [],
		});
	});

	it("counts every product of the catalogue as the total", () => {
		const metrics = dashboardMetrics(
			[
				product({ id: "p1" }),
				product({ id: "p2", name: "Yerba mate 1kg", sku: "YER-1000" }),
			],
			[],
		);

		expect(metrics.totalProducts).toBe(2);
	});

	it("values the inventory at cost, in integer cents", () => {
		// L27: el mismo cálculo que el gráfico, Σ (unitCost × stock), sin floats.
		const metrics = dashboardMetrics(
			[
				product({ id: "p1", unitCost: "1500.00", stockQuantity: 2 }),
				product({
					id: "p2",
					name: "Yerba mate 1kg",
					unitCost: "0.10",
					stockQuantity: 3,
				}),
			],
			[],
		);

		expect(metrics.inventoryValueCents).toBe(300030);
	});

	it("sums the potential margin of the stock at cost, sign included", () => {
		// L27: Σ (marginPerUnit × stock). Un producto bajo el costo baja el total.
		const metrics = dashboardMetrics(
			[
				product({ id: "p1", marginPerUnit: "500.00", stockQuantity: 2 }),
				product({
					id: "p2",
					name: "Yerba mate 1kg",
					marginPerUnit: "-20500.00",
					stockQuantity: 1,
				}),
			],
			[],
		);

		expect(metrics.marginPotentialCents).toBe(-1950000);
	});

	it("counts the products with stock and no known cost", () => {
		const metrics = dashboardMetrics(
			[
				product({ id: "p1" }),
				uncosted({ id: "p2", name: "Yerba mate 1kg", stockQuantity: 3 }),
				uncosted({ id: "p3", name: "Azúcar 1kg", stockQuantity: 1 }),
			],
			[],
		);

		expect(metrics.productsWithoutCost).toBe(2);
		// Los dos sin costo no aportan: el valor es sólo el del producto con costo.
		expect(metrics.inventoryValueCents).toBe(200000);
	});

	it("does not count a sold-out product as one without cost", () => {
		const metrics = dashboardMetrics(
			[
				uncosted({ id: "p1", stockQuantity: 0 }),
				product({ id: "p2", name: "Yerba mate 1kg" }),
			],
			[],
		);

		// Sin stock no hay valor que atribuir: el producto no es "sin costo".
		expect(metrics.productsWithoutCost).toBe(0);
	});

	it("treats the threshold as inclusive, so a zero threshold flags stock 0", () => {
		// L4: crítico es stockQuantity <= lowStockThreshold, no === 0.
		const metrics = dashboardMetrics(
			[product({ stockQuantity: 0, lowStockThreshold: 0 })],
			[],
		);

		expect(metrics.criticalCount).toBe(1);
		expect(metrics.outOfStockCount).toBe(1);
		expect(metrics.lowStockOnlyCount).toBe(0);
		expect(metrics.criticalProducts).toHaveLength(1);
	});

	it("counts a product with a positive threshold as low stock, not as out of stock", () => {
		// Un umbral editable (MI-12) marca stock bajo sin tocar el dashboard.
		const metrics = dashboardMetrics(
			[product({ stockQuantity: 2, lowStockThreshold: 3 })],
			[],
		);

		expect(metrics.criticalCount).toBe(1);
		expect(metrics.outOfStockCount).toBe(0);
		expect(metrics.lowStockOnlyCount).toBe(1);
	});

	it("counts the threshold itself as critical", () => {
		const metrics = dashboardMetrics(
			[product({ stockQuantity: 3, lowStockThreshold: 3 })],
			[],
		);

		expect(metrics.criticalCount).toBe(1);
		expect(metrics.lowStockOnlyCount).toBe(1);
	});

	it("counts no critical product when the whole catalogue is above its threshold", () => {
		const metrics = dashboardMetrics(
			[
				product({ id: "p1", stockQuantity: 1, lowStockThreshold: 0 }),
				product({
					id: "p2",
					name: "Yerba mate 1kg",
					stockQuantity: 3,
					lowStockThreshold: 3,
				}),
			].map((row) => ({ ...row, stockQuantity: row.stockQuantity + 1 })),
			[],
		);

		expect(metrics.criticalCount).toBe(0);
		expect(metrics.outOfStockCount).toBe(0);
		expect(metrics.lowStockOnlyCount).toBe(0);
		expect(metrics.criticalProducts).toEqual([]);
	});

	it("keeps out-of-stock and low-stock apart in the same catalogue", () => {
		const metrics = dashboardMetrics(
			[
				product({ id: "p1", stockQuantity: 0 }),
				product({ id: "p2", name: "Yerba", stockQuantity: 2 }),
				product({
					id: "p3",
					name: "Azúcar",
					stockQuantity: 1,
					lowStockThreshold: 4,
				}),
			],
			[],
		);

		expect(metrics.criticalCount).toBe(2);
		expect(metrics.outOfStockCount).toBe(1);
		expect(metrics.lowStockOnlyCount).toBe(1);
	});

	it("orders the critical products by units and then by name", () => {
		// S3: unidades ascendente; el nombre desempata para que no se reordenen.
		const metrics = dashboardMetrics(
			[
				product({
					id: "p1",
					name: "Zanahoria",
					stockQuantity: 2,
					lowStockThreshold: 2,
				}),
				product({ id: "p2", name: "Ananá", stockQuantity: 0 }),
				product({
					id: "p3",
					name: "Banana",
					stockQuantity: 2,
					lowStockThreshold: 2,
				}),
				product({
					id: "p4",
					name: "Kiwi",
					stockQuantity: 9,
					lowStockThreshold: 0,
				}),
			],
			[],
		);

		expect(metrics.criticalProducts.map((row) => row.name)).toEqual([
			"Ananá",
			"Banana",
			"Zanahoria",
		]);
	});

	it("reads the units moved today from the last point of the series", () => {
		// S2: entries + exits del último punto, que es hoy en UTC.
		const metrics = dashboardMetrics(
			[],
			[point("2026-10-19", 5, 2), point("2026-10-20", 3, 4)],
		);

		expect(metrics.unitsToday).toBe(7);
	});

	it("counts zero units moved today when the series brings no points", () => {
		expect(dashboardMetrics([product()], []).unitsToday).toBe(0);
	});
});
