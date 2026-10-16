import { isInaccessible } from "@testing-library/dom";
import { render, screen } from "@testing-library/react";
import { StockBadge, type StockStatus, stockStatus } from "../stock-badge";

describe("StockBadge", () => {
	for (const [status, config] of Object.entries(stockStatus)) {
		it(`renders a visible, non-empty label for ${status}`, () => {
			render(<StockBadge status={status as StockStatus} />);

			const badge = screen.getByText(config.label);
			// These badges are generic spans: their accessible name is their
			// text content, so both checks guard against a colour-only state.
			expect(badge.textContent?.trim()).toBe(config.label);
			expect(isInaccessible(badge)).toBe(false);
		});
	}

	it("falls back to a visible label for an invalid status", () => {
		render(<StockBadge status={"not-a-real-status" as StockStatus} />);

		const badge = screen.getByText("Descontinuado");
		expect(badge.textContent?.trim()).toBe("Descontinuado");
		expect(isInaccessible(badge)).toBe(false);
	});
});
