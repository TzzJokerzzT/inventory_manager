import { render, screen, within } from "@testing-library/react";
import { useCompanies } from "@/src/features/company/api/use-companies";
import { useCompanyStore } from "@/src/features/company/store/company-store";
import { useProducts } from "@/src/features/product/api/use-products";
import { dashboardKpis, stockTableRows } from "@/src/utils/mockData";
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
		photoUrl: null,
		stockQuantity: 2,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

function mockCharts() {
	useProductsMock.mockReturnValue({
		data: [product()],
		isPending: false,
		isError: false,
		error: undefined,
	} as unknown as ReturnType<typeof useProducts>);
	useMovementTrendMock.mockReturnValue({
		data: {
			days: 30,
			series: [{ date: "2026-10-20", entries: 3, exits: 1 }],
		},
		isPending: false,
		isError: false,
		error: undefined,
	} as unknown as ReturnType<typeof useMovementTrend>);
}

describe("DashboardView", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useCompanyStore.setState({ activeCompanyId: undefined });
		mockCompanies({ data: [company("c1", "Primera")] });
		mockCharts();
	});

	it("renders the KPI cards from the mock module", () => {
		render(<Dashboard />);

		for (const kpi of dashboardKpis) {
			expect(screen.getByText(kpi.label)).toBeTruthy();
		}
		expect(screen.getByText("1.248")).toBeTruthy();
		expect(screen.getByText("$ 84.320")).toBeTruthy();
	});

	it("shows a visible sample-data notice that cannot be mistaken for real data", () => {
		render(<Dashboard />);

		const notice = screen.getByRole("status");
		expect(notice).toBeTruthy();
		expect(notice.textContent).toContain("Datos de muestra");
		expect(notice.textContent).toContain("números de ejemplo");
	});

	it("renders the stock table rows through DataTable", () => {
		const { container } = render(<Dashboard />);

		expect(container.querySelector('[data-slot="data-table"]')).toBeTruthy();
		for (const row of stockTableRows) {
			expect(screen.getByText(row.name)).toBeTruthy();
			expect(screen.getByText(row.sku)).toBeTruthy();
		}
	});

	it("maps each stock badge status to its visible label", () => {
		render(<Dashboard />);

		expect(screen.getByText("Agotado")).toBeTruthy();
		expect(screen.getByText("Stock bajo")).toBeTruthy();
		expect(screen.getByText("En stock")).toBeTruthy();
	});

	it("shows the real active company from the mocked query", () => {
		render(<Dashboard />);

		// La empresa activa es el dato real del encabezado; el mock solo cubre
		// KPIs, alertas y tabla, así que el nombre viene de la query mockeada.
		expect(screen.getByText("Empresa activa: Primera")).toBeTruthy();
	});

	it("scopes the sample-data notice to the KPIs, alerts and table", () => {
		render(<Dashboard />);

		// S5: el aviso cubre solo lo que sigue mockeado (MI-6/MI-9); no puede
		// hablar de los gráficos, que son datos reales.
		const notice = screen.getByRole("status");
		expect(notice.textContent).toContain(
			"Los indicadores, las alertas y la tabla",
		);
		expect(notice.textContent).not.toMatch(/gr[aá]ficos/i);
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
		expect(
			within(charts).getAllByText(/datos reales de la empresa activa/i),
		).toHaveLength(4);
	});

	it("feeds the charts with the real data of the active company", () => {
		render(<Dashboard />);

		const charts = screen.getByRole("region", { name: "Gráficos" });

		// Distribución: un producto con stock, ninguno agotado.
		const statusChart = within(charts).getByRole("region", {
			name: "Distribución del stock",
		});
		expect(within(statusChart).getByText("Con stock")).toBeTruthy();
		expect(within(statusChart).getByText("Agotados")).toBeTruthy();

		// Valor: 2 × 1500,00 en centavos enteros.
		const valueChart = within(charts).getByRole("region", {
			name: "Valor del inventario",
		});
		// El total aparece en la tarjeta y en la fila del producto: las dos son
		// el mismo número, así que se verifica la fila de la tabla.
		const valueRows = within(
			within(valueChart).getByRole("table"),
		).getAllByRole("row");
		expect(within(valueRows[1]).getByText("Café molido 500g")).toBeTruthy();
		expect(within(valueRows[1]).getByText("$ 3.000,00")).toBeTruthy();

		// Evolución: la serie que devolvió el reporte.
		const trendChart = within(charts).getByRole("region", {
			name: "Evolución de entradas y salidas",
		});
		expect(
			within(trendChart).getByText(
				"En los últimos 30 días entraron 3 unidades y salieron 1.",
			),
		).toBeTruthy();
	});

	it("keeps the mocked KPIs, alerts and table next to the real charts", () => {
		render(<Dashboard />);

		// Los gráficos no reemplazan lo que sigue mockeado (MI-6/MI-9).
		expect(screen.getByText(dashboardKpis[0].label)).toBeTruthy();
		expect(screen.getByText("Alertas de Stock")).toBeTruthy();
		expect(screen.getByText(stockTableRows[0].name)).toBeTruthy();
	});
});
