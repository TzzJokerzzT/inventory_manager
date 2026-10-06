import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "../kpi-card";

describe("KpiCard", () => {
	it("renders the label and value", () => {
		render(<KpiCard label="Total de productos" value="1.248" />);

		expect(screen.getByText("Total de productos")).toBeTruthy();
		expect(screen.getByText("1.248")).toBeTruthy();
	});

	it("renders a signed delta for both directions, not colour-only", () => {
		const { container } = render(
			<>
				<KpiCard
					label="Sube"
					value={1}
					delta={{ value: "4,2%", direction: "up" }}
				/>
				<KpiCard
					label="Baja"
					value={2}
					delta={{ value: "2,1%", direction: "down" }}
				/>
			</>,
		);

		// The sign is part of the visible text, so the direction never relies
		// on colour alone.
		expect(screen.getByText("+4,2%")).toBeTruthy();
		expect(screen.getByText("−2,1%")).toBeTruthy();

		// The arrow icon is an additional non-colour cue and stays decorative.
		const icons = container.querySelectorAll("svg");
		expect(icons.length).toBe(2);
		for (const icon of icons) {
			expect(icon.getAttribute("aria-hidden")).toBe("true");
		}
	});

	it("defaults the delta caption to 'vs. mes anterior'", () => {
		render(
			<KpiCard
				label="Sube"
				value={1}
				delta={{ value: "4%", direction: "up" }}
			/>,
		);
		expect(screen.getByText("vs. mes anterior")).toBeTruthy();
	});

	it("applies the warning surface classes for the alert tone", () => {
		const { container } = render(
			<KpiCard label="Bajo" value={12} tone="alert" />,
		);

		const card = container.querySelector('[data-slot="kpi-card"]');
		expect(card?.className).toContain("bg-warning-soft");
		expect(card?.className).toContain("border-warning");
	});

	it("renders the note", () => {
		render(<KpiCard label="Bajo" value={12} note="Requieren reposición" />);
		expect(screen.getByText("Requieren reposición")).toBeTruthy();
	});
});
