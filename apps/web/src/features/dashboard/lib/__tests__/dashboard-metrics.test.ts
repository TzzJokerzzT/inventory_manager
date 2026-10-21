import type { MovementTrendPoint, Product } from "@/lib/api/schemas";
import { dashboardMetrics } from "../dashboard-metrics";

function product(overrides: Partial<Product> = {}): Product {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		photoUrl: null,
		stockQuantity: 2,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
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

	it("sums the inventory value in integer cents", () => {
		// Mismo cálculo que el gráfico de MI-14: precio × stock, sin floats.
		const metrics = dashboardMetrics(
			[
				product({ id: "p1", price: "1500.00", stockQuantity: 2 }),
				product({
					id: "p2",
					name: "Yerba mate 1kg",
					price: "0.10",
					stockQuantity: 3,
				}),
			],
			[],
		);

		expect(metrics.inventoryValueCents).toBe(300030);
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
