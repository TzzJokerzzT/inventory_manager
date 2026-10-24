import { render, screen, within } from "@testing-library/react";
import { useCompanies } from "@/src/features/company/api/use-companies";
import { useCompanyStore } from "@/src/features/company/store/company-store";
import { useProducts } from "@/src/features/product/api/use-products";
import { useMovementTrend } from "../api/use-movement-trend";
import { Dashboard } from "../components/Dashboard";

jest.mock("recharts", () => jest.requireActual("../testing/recharts-mock"));

jest.mock("@/src/features/company/api/use-companies", () => ({
	useCompanies: jest.fn(),
}));

jest.mock("@/src/features/product/api/use-products", () => ({
	useProducts: jest.fn(),
}));

jest.mock("../api/use-movement-trend", () => ({
	...jest.requireActual("../api/use-movement-trend"),
	useMovementTrend: jest.fn(),
}));

const useCompaniesMock = useCompanies as jest.MockedFunction<
	typeof useCompanies
>;
const useProductsMock = useProducts as jest.MockedFunction<typeof useProducts>;
const useMovementTrendMock = useMovementTrend as jest.MockedFunction<
	typeof useMovementTrend
>;

function company(id: string, name: string) {
	return { id, name, createdAt: "2026-10-06T00:00:00.000Z" };
}

function mockCompanies(state: Partial<ReturnType<typeof useCompanies>> = {}) {
	useCompaniesMock.mockReturnValue({
		data: undefined,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
		...state,
	} as unknown as ReturnType<typeof useCompanies>);
}

function product(overrides: Record<string, unknown> = {}) {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		measureUnit: "KILOGRAM" as const,
		availableUnits: 2,
		// The catalogue row carries the derived cost figures the contract requires
		// (L27): they are what the dashboard values the stock with.
		availableMeasure: "2.000",
		costPerMeasure: "500.000",
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

/**
 * Catalogue of the active company: one out-of-stock product, one below a
 * positive threshold and one healthy, so the derived metrics cover the three
 * states.
 */
function catalogue() {
	return [
		product({
			id: "p1",
			name: "Café molido 500g",
			sku: "CAF-500",
			stockQuantity: 0,
			// Sold out: no units left, so no cost and no margin (L11).
			availableUnits: 0,
			availableMeasure: "0.000",
			costPerMeasure: null,
			unitCost: null,
			marginPerUnit: null,
		}),
		product({
			id: "p2",
			name: "Yerba mate 1kg",
			sku: "YER-1000",
			price: "2000.00",
			stockQuantity: 3,
			lowStockThreshold: 5,
			availableUnits: 3,
			availableMeasure: "3.000",
			costPerMeasure: "1500.000",
			unitCost: "1500.00",
			marginPerUnit: "500.00",
		}),
		product({
			id: "p3",
			name: "Azúcar 1kg",
			sku: "AZU-1000",
			price: "1000.00",
			stockQuantity: 4,
			lowStockThreshold: 0,
			availableUnits: 4,
			availableMeasure: "4.000",
			costPerMeasure: "800.000",
			unitCost: "800.00",
			marginPerUnit: "200.00",
		}),
	];
}

function mockProducts(state: Partial<ReturnType<typeof useProducts>> = {}) {
	useProductsMock.mockReturnValue({
		data: catalogue(),
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useProducts>);
}

function mockTrend(state: Partial<ReturnType<typeof useMovementTrend>> = {}) {
	useMovementTrendMock.mockReturnValue({
		data: {
			days: 30,
			series: [
				{ date: "2026-10-19", entries: 9, exits: 0 },
				{ date: "2026-10-20", entries: 3, exits: 1 },
			],
		},
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useMovementTrend>);
}

/** The value a KPI card renders under its label, as the person sees it. */
function cardValue(label: string): string {
	const card = screen.getByText(label).closest('[data-slot="kpi-card"]');
	const values = card?.querySelectorAll("p") ?? [];
	return values[1]?.textContent ?? "";
}

describe("DashboardView", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useCompanyStore.setState({ activeCompanyId: undefined });
		mockCompanies({ data: [company("c1", "Primera")] });
		mockProducts();
		mockTrend();
	});

	it("reaches the KPI cards with the metrics of the active company", () => {
		// S2: los cuatro KPIs salen del catálogo y del reporte de evolución.
		render(<Dashboard />);

		expect(cardValue("Total de productos")).toBe("3");
		// L27: a costo, 1500,00 × 3 + 800,00 × 4, en centavos enteros. El precio de
		// lista (2000,00 y 1000,00) no entra en la cuenta.
		expect(cardValue("Valor del inventario (a costo)")).toBe("$ 7.700,00");
		// Y el margen potencial del mismo stock: 500,00 × 3 + 200,00 × 4.
		expect(cardValue("Margen potencial")).toBe("$ 2.300,00");
		expect(cardValue("Productos con stock crítico")).toBe("2");
		// entries + exits del último punto de la serie (hoy, UTC).
		expect(cardValue("Unidades movidas hoy (UTC)")).toBe("4");
	});

	it("notes the products with stock and no known cost beside the value", () => {
		// L27: esos productos no aportan al valor ni al margen y se informan aparte.
		mockProducts({
			data: [
				product({ id: "p1", name: "Café", stockQuantity: 4 }),
				product({
					id: "p2",
					name: "Yerba",
					stockQuantity: 2,
					availableUnits: 0,
					availableMeasure: "0.000",
					costPerMeasure: null,
					unitCost: null,
					marginPerUnit: null,
				}),
			],
		});

		render(<Dashboard />);

		expect(cardValue("Valor del inventario (a costo)")).toBe("$ 4.000,00");
		expect(screen.getByText("1 producto sin costo conocido")).toBeTruthy();
	});

	it("no longer shows a sample-data notice nor sample numbers", () => {
		// S5: el dashboard ya no mezcla datos de muestra con los reales.
		render(<Dashboard />);

		expect(screen.queryByText(/datos de muestra/i)).toBeNull();
		expect(screen.queryByText(/números de ejemplo/i)).toBeNull();
		expect(screen.queryByText("1.248")).toBeNull();
		expect(screen.queryByText("$ 84.320")).toBeNull();
	});

	it("renders the critical products in the stock table, ordered by units", () => {
		// S3: la tabla es la misma regla que el KPI, no una lista aparte.
		render(<Dashboard />);

		const table = screen.getByRole("region", { name: "Stock crítico" });
		const rows = within(table).getAllByRole("row");

		expect(rows).toHaveLength(3);
		expect(within(rows[1]).getByText("Café molido 500g")).toBeTruthy();
		expect(within(rows[1]).getByText("Agotado")).toBeTruthy();
		expect(within(rows[2]).getByText("Yerba mate 1kg")).toBeTruthy();
		expect(within(rows[2]).getByText("Stock bajo")).toBeTruthy();
		expect(within(table).queryByText("Azúcar 1kg")).toBeNull();
	});

	it("shows the empty state of the critical table when nothing is critical", () => {
		mockProducts({
			data: [product({ stockQuantity: 9, lowStockThreshold: 0 })],
		});

		render(<Dashboard />);

		const table = screen.getByRole("region", { name: "Stock crítico" });
		expect(
			within(table).getByText("No hay productos con stock crítico."),
		).toBeTruthy();
	});

	it("derives the alerts from the same catalogue", () => {
		// S4: peligro por los agotados, advertencia por los que están bajo umbral.
		render(<Dashboard />);

		const alerts = screen.getAllByRole("alert");
		const titles = alerts.map((alert) => alert.textContent ?? "");

		expect(titles.some((text) => text.includes("1 producto agotado"))).toBe(
			true,
		);
		expect(
			titles.some((text) => text.includes("1 producto con stock bajo")),
		).toBe(true);
	});

	it("shows an informative message instead of invented alerts", () => {
		mockProducts({
			data: [product({ stockQuantity: 9, lowStockThreshold: 0 })],
		});

		render(<Dashboard />);

		const status = screen.getAllByRole("status");
		expect(
			status.some((node) => node.textContent?.includes("Sin alertas de stock")),
		).toBe(true);
		expect(screen.queryAllByRole("alert")).toHaveLength(0);
	});

	it("keeps the loading state while the queries are pending", () => {
		mockProducts({ data: undefined, isPending: true });
		mockTrend({ data: undefined, isPending: true });

		render(<Dashboard />);

		const section = screen.getByRole("region", { name: "Indicadores" });
		expect(section.getAttribute("aria-busy")).toBe("true");
		expect(within(section).getAllByText("—")).toHaveLength(5);
		expect(
			screen.getByText("Cargando los datos de la empresa activa…"),
		).toBeTruthy();
	});

	it("reports a failed read once, without duplicating it per section", () => {
		mockProducts({
			data: undefined,
			isError: true,
			error: new Error("boom"),
		});

		render(<Dashboard />);

		const dashboards = screen.getAllByText(
			"No pudimos cargar las métricas del dashboard",
		);
		expect(dashboards).toHaveLength(1);
		expect(screen.queryByText("Datos de muestra")).toBeNull();
	});

	it("shows the real active company from the mocked query", () => {
		render(<Dashboard />);

		expect(screen.getByText("Empresa activa: Primera")).toBeTruthy();
	});

	it("renders the three real-data charts in a Gráficos section", () => {
		render(<Dashboard />);

		const charts = screen.getByRole("region", { name: "Gráficos" });
		const sections = within(charts).getAllByRole("region");

		expect(
			sections.map((section) => section.getAttribute("aria-label")),
		).toEqual([
			"Distribución del stock",
			"Valor del inventario",
			"Evolución de entradas y salidas",
		]);
		// One caption per chart: each chart states its own source, so the
		// section-level caption the dashboard used to render is not needed.
		expect(
			within(charts).getAllByText(/datos reales de la empresa activa/i),
		).toHaveLength(3);
	});

	it("keeps feeding the charts with the catalogue and the series", () => {
		render(<Dashboard />);

		const charts = screen.getByRole("region", { name: "Gráficos" });

		// Distribución: dos productos con stock y uno agotado.
		const statusChart = within(charts).getByRole("region", {
			name: "Distribución del stock",
		});
		expect(within(statusChart).getByText("Con stock")).toBeTruthy();
		const statusRows = within(
			within(statusChart).getByRole("table"),
		).getAllByRole("row");
		expect(within(statusRows[1]).getByText("2")).toBeTruthy();
		expect(within(statusRows[2]).getByText("1")).toBeTruthy();

		// Valor: el ranking de productos con stock, en centavos enteros.
		const valueChart = within(charts).getByRole("region", {
			name: "Valor del inventario",
		});
		const valueRows = within(
			within(valueChart).getByRole("table"),
		).getAllByRole("row");
		expect(within(valueRows[1]).getByText("Yerba mate 1kg")).toBeTruthy();
		// A costo: 1500,00 × 3 y 800,00 × 4.
		expect(within(valueRows[1]).getByText("$ 4.500,00")).toBeTruthy();
		expect(within(valueRows[2]).getByText("$ 3.200,00")).toBeTruthy();

		// Evolución: la serie que devolvió el reporte de 30 días.
		const trendChart = within(charts).getByRole("region", {
			name: "Evolución de entradas y salidas",
		});
		expect(
			within(trendChart).getByText(
				"En los últimos 30 días entraron 12 unidades y salieron 1.",
			),
		).toBeTruthy();
	});

	it("updates the cards, the alerts and the table when the data changes", () => {
		const view = render(<Dashboard />);

		expect(cardValue("Total de productos")).toBe("3");

		mockProducts({
			data: [
				product({
					id: "p9",
					name: "Fideos 500g",
					sku: "FID-500",
					stockQuantity: 0,
					lowStockThreshold: 0,
				}),
			],
		});
		mockTrend({ data: { days: 30, series: [] } });
		view.rerender(<Dashboard />);

		expect(cardValue("Total de productos")).toBe("1");
		expect(cardValue("Productos con stock crítico")).toBe("1");
		expect(cardValue("Unidades movidas hoy (UTC)")).toBe("0");
		const table = screen.getByRole("region", { name: "Stock crítico" });
		expect(within(table).getByText("Fideos 500g")).toBeTruthy();
		expect(within(table).queryByText("Yerba mate 1kg")).toBeNull();
	});
});
