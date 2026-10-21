import { render, screen } from "@testing-library/react";
import { KPIs } from "../components/KPIs";
import type { DashboardMetrics } from "../lib/dashboard-metrics";

function metrics(overrides: Partial<DashboardMetrics> = {}): DashboardMetrics {
	return {
		totalProducts: 3,
		inventoryValueCents: 300000,
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
	it("renders the four cards with the metrics of the active company", () => {
		// S2: total de productos, valor del inventario, críticos y unidades de hoy.
		render(<KPIs metrics={metrics()} />);

		expect(cardValue("Total de productos")).toBe("3");
		expect(cardValue("Valor del inventario")).toBe("$ 3.000,00");
		expect(cardValue("Productos con stock crítico")).toBe("2");
		expect(cardValue("Unidades movidas hoy (UTC)")).toBe("7");
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
		expect(screen.getAllByText("—")).toHaveLength(4);
		expect(screen.queryByText("$ 3.000,00")).toBeNull();
	});

	it("keeps the responsive KPI grid", () => {
		// S6: 1 columna en móvil, 2 en tablet y 4 en escritorio.
		render(<KPIs metrics={metrics()} />);

		const section = screen.getByRole("region", { name: "Indicadores" });
		expect(section.className).toContain("sm:grid-cols-2");
		expect(section.className).toContain("lg:grid-cols-4");
	});
});
