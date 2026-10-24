import {
	deriveMovementMargin,
	deriveProductCosts,
} from "../src/domain/costing/derived-costs.js";
import { DomainError } from "../src/domain/errors/domain-error.js";

/**
 * The money of this slice is exact by construction: prices, costs and margins
 * are integers of cents and measures are integers of thousandths, so every
 * assertion below is a string equality with no float in the way (L11, L12).
 */
describe("deriveMovementMargin", () => {
	it("computes the income of the whole sale minus the cost of its units", () => {
		// 3 rolls sold at 2500.00 each, costing 1200.50, 1100.00 and 900.75.
		expect(
			deriveMovementMargin("2500.00", 3, ["1200.50", "1100.00", "900.75"]),
		).toBe("4298.75");
	});

	it("keeps the cents exact instead of going through a float", () => {
		// 7500.15 - (1234.56 + 2345.67) = 3919.92, and 0.1 + 0.2 in floats is
		// exactly the kind of rounding this rule forbids.
		expect(deriveMovementMargin("2500.05", 3, ["1234.56", "2345.67"])).toBe(
			"3919.92",
		);
	});

	it("reports a loss as a negative margin", () => {
		// 2 × 100.00 is 200.00 of income against 300.00 of cost.
		expect(deriveMovementMargin("100.00", 2, ["150.00", "150.00"])).toBe(
			"-100.00",
		);
	});

	it("answers null for a sale without a written price (S9)", () => {
		expect(deriveMovementMargin(null, 2, ["150.00", "150.00"])).toBeNull();
	});

	it("answers null for a sale without units instead of a zero margin", () => {
		expect(deriveMovementMargin("2500.00", 2, [])).toBeNull();
	});

	it("rejects a stored cost it cannot read instead of inventing a margin", () => {
		expect(() => deriveMovementMargin("2500.00", 1, ["not-money"])).toThrow(
			DomainError,
		);
	});
});

describe("deriveProductCosts", () => {
	it("derives the cost per measure and per unit from the available units", () => {
		// 10.000 kg available for 59000.00 -> 5900.00 per measure; two units ->
		// 29500.00 each; the list price minus that unit cost is the margin.
		const costs = deriveProductCosts("9000.00", {
			unitCount: 2,
			measureTotal: "10.000",
			costTotal: "59000.00",
		});

		expect(costs).toEqual({
			availableUnits: 2,
			availableMeasure: "10.000",
			costPerMeasure: "5900.00",
			unitCost: "29500.00",
			marginPerUnit: "-20500.00",
		});
	});

	it("rounds the measure to three decimals and the money to two", () => {
		// 3.000 kg for 10.00 -> 3.333... per measure, rounded half up to 3.33;
		// three units -> 3.333... each, rounded to 3.33.
		const costs = deriveProductCosts("10.00", {
			unitCount: 3,
			measureTotal: "3.000",
			costTotal: "10.00",
		});

		expect(costs.availableMeasure).toBe("3.000");
		expect(costs.costPerMeasure).toBe("3.33");
		expect(costs.unitCost).toBe("3.33");
		expect(costs.marginPerUnit).toBe("6.67");
	});

	it("answers null costs but still answers when no unit is available", () => {
		expect(deriveProductCosts("9000.00", null)).toEqual({
			availableUnits: 0,
			availableMeasure: "0.000",
			costPerMeasure: null,
			unitCost: null,
			marginPerUnit: null,
		});
	});

	it("follows the listed price for the margin per unit", () => {
		const totals = {
			unitCount: 1,
			measureTotal: "12.500",
			costTotal: "73750.00",
		};

		expect(deriveProductCosts("80000.00", totals).marginPerUnit).toBe(
			"6250.00",
		);
		// The list price is the only input that moves the margin.
		expect(deriveProductCosts("90000.00", totals).marginPerUnit).toBe(
			"16250.00",
		);
	});
});
