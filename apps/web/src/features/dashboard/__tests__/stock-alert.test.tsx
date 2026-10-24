import { render, screen } from "@testing-library/react";
import { StockAlerts } from "../components/StockAlert";
import type { DashboardMetrics } from "../lib/dashboard-metrics";

function metrics(overrides: Partial<DashboardMetrics> = {}): DashboardMetrics {
	return {
		totalProducts: 3,
		inventoryValueCents: 0,
		marginPotentialCents: 0,
		productsWithoutCost: 0,
		criticalCount: 0,
		outOfStockCount: 0,
		lowStockOnlyCount: 0,
		unitsToday: 0,
		...overrides,
	};
}

describe("StockAlerts", () => {
	it("shows a danger alert when some product is out of stock", () => {
		// S4: una alerta de peligro si hay agotados, con el número real.
		render(
			<StockAlerts
				metrics={metrics({ outOfStockCount: 2, criticalCount: 2 })}
			/>,
		);

		const alerts = screen.getAllByRole("alert");
		expect(alerts).toHaveLength(1);
		expect(alerts[0].textContent).toContain("2 productos agotados");
		expect(alerts[0].textContent).toContain("Sin unidades disponibles");
	});

	it("shows a warning alert for low stock without out-of-stock products", () => {
		render(
			<StockAlerts
				metrics={metrics({ lowStockOnlyCount: 3, criticalCount: 3 })}
			/>,
		);

		const alerts = screen.getAllByRole("alert");
		expect(alerts).toHaveLength(1);
		expect(alerts[0].textContent).toContain("3 productos con stock bajo");
	});

	it("shows both alerts when the catalogue has out-of-stock and low-stock products", () => {
		render(
			<StockAlerts
				metrics={metrics({
					outOfStockCount: 1,
					lowStockOnlyCount: 1,
					criticalCount: 2,
				})}
			/>,
		);

		const alerts = screen.getAllByRole("alert");
		expect(alerts).toHaveLength(2);
		expect(alerts[0].textContent).toContain("1 producto agotado");
		expect(alerts[1].textContent).toContain("1 producto con stock bajo");
	});

	it("shows an informative message when there is no stock alert", () => {
		render(<StockAlerts metrics={metrics()} />);

		const status = screen.getByRole("status");
		expect(status.textContent).toContain("Sin alertas de stock");
		expect(screen.queryAllByRole("alert")).toHaveLength(0);
	});

	it("renders nothing while the metrics are not available", () => {
		// S4: sin datos no se inventan alertas ni se anuncia un falso "sin alertas".
		const { container } = render(<StockAlerts metrics={undefined} />);

		expect(container.innerHTML).toBe("");
	});
});
