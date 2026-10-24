import { render, screen } from "@testing-library/react";
import { KPIs } from "../components/KPIs";
import type { DashboardMetrics } from "../lib/dashboard-metrics";

function metrics(overrides: Partial<DashboardMetrics> = {}): DashboardMetrics {
	return {
		totalProducts: 3,
		inventoryValueCents: 300000,
		marginPotentialCents: 120000,
		productsWithoutCost: 0,
		criticalCount: 2,
		outOfStockCount: 1,
		lowStockOnlyCount: 1,
		unitsToday: 7,
		...overrides,
	};
}

/** The value a card renders under its label, read as the person sees it. */
function cardValue(label: string): string {
	const label_ = screen.getByText(label);
	const card = label_.closest('[data-slot="kpi-card"]');
	const values = card?.querySelectorAll("p") ?? [];
	return values[1]?.textContent ?? "";
}

describe("KPIs", () => {
	it("renders the five cards with the metrics of the active company", () => {
		// S2 + L27: productos, valor a costo, margen potencial, críticos y hoy.
		render(<KPIs metrics={metrics()} />);

		expect(cardValue("Total de productos")).toBe("3");
		expect(cardValue("Valor del inventario (a costo)")).toBe("$ 3.000,00");
		expect(cardValue("Margen potencial")).toBe("$ 1.200,00");
		expect(cardValue("Productos con stock crítico")).toBe("2");
		expect(cardValue("Unidades movidas hoy (UTC)")).toBe("7");
	});

	it("says in the label that the inventory value is at cost", () => {
		// L27: el valor del inventario dejó de ser el precio de lista.
		render(<KPIs metrics={metrics()} />);

		expect(screen.getByText(/a costo/)).toBeTruthy();
	});

	it("renders a negative potential margin with its sign", () => {
		// L27: vender bajo el costo es real y el número lo dice.
		render(<KPIs metrics={metrics({ marginPotentialCents: -1950000 })} />);

		expect(cardValue("Margen potencial")).toBe("-$ 19.500,00");
	});

	it("notes how many products have no known cost", () => {
		// L27: los que no tienen costo no valen cero, se informan aparte.
		render(<KPIs metrics={metrics({ productsWithoutCost: 1 })} />);

		expect(screen.getByText("1 producto sin costo conocido")).toBeTruthy();
	});

	it("pluralizes the products without a known cost", () => {
		render(<KPIs metrics={metrics({ productsWithoutCost: 3 })} />);

		expect(screen.getByText("3 productos sin costo conocido")).toBeTruthy();
	});

	it("shows no note when every product has a known cost", () => {
		render(<KPIs metrics={metrics({ productsWithoutCost: 0 })} />);

		expect(screen.queryByText(/sin costo conocido/)).toBeNull();
	});

	it("labels the units of the day as UTC", () => {
		// S2: el cuarto KPI es hoy en UTC, y lo dice.
		render(<KPIs metrics={metrics()} />);

		expect(screen.getByText(/\(UTC\)/)).toBeTruthy();
	});

	it("shows a placeholder instead of a number while the queries are loading", () => {
		render(<KPIs isLoading />);

		const section = screen.getByRole("region", { name: "Indicadores" });
		expect(section.getAttribute("aria-busy")).toBe("true");
		expect(screen.getAllByText("—")).toHaveLength(5);
		expect(screen.queryByText("$ 3.000,00")).toBeNull();
		expect(screen.queryByText(/sin costo conocido/)).toBeNull();
	});

	it("keeps the responsive KPI grid", () => {
		// S6: 1 columna en móvil, 2 en tablet y todas en una fila en escritorio.
		render(<KPIs metrics={metrics()} />);

		const section = screen.getByRole("region", { name: "Indicadores" });
		expect(section.className).toContain("sm:grid-cols-2");
		expect(section.className).toContain("xl:grid-cols-5");
	});
});
