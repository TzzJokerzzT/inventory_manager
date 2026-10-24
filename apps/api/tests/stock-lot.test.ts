import { StockLot } from "../src/domain/entities/stock-lot.js";
import { DomainError } from "../src/domain/errors/domain-error.js";

function lot(overrides: Partial<Parameters<typeof StockLot.create>[0]> = {}) {
	return StockLot.create({
		companyId: "company-1",
		productId: "product-1",
		supplierId: "supplier-1",
		costPerMeasure: "5900",
		measures: [12.5, 10],
		...overrides,
	});
}

/** Money as an integer amount of cents, so the arithmetic of a test never floats. */
function cents(decimal: string): number {
	return Number(decimal.replace(".", ""));
}

/** A measure as an integer amount of thousandths (`Decimal(12,3)`). */
function milli(decimal: string): number {
	return Number(decimal.replace(".", ""));
}

/**
 * `measureTotal × costPerMeasure` in cents: the identity the unit costs must add
 * up to. Thousandths times cents is divided by 1000 to become cents.
 */
function totalCents(measureTotal: string, costPerMeasure: string): number {
	return Math.round((milli(measureTotal) * cents(costPerMeasure)) / 1000);
}

describe("StockLot.create", () => {
	it("derives the measure total from the units and normalizes the decimals", () => {
		const created = lot();

		// L6: the total is the sum of the units, never a second input.
		expect(created.measureTotal).toBe("22.500");
		expect(created.costPerMeasure).toBe("5900.00");
		expect(created.unitCount).toBe(2);
		expect(created.note).toBeNull();
	});

	it("generates the unit codes from the position", () => {
		const created = lot({ measures: [12.5, 10, 3] });

		expect(created.units.map((unit) => unit.code)).toEqual([
			"R-01",
			"R-02",
			"R-03",
		]);
		expect(created.units.every((unit) => unit.status === "AVAILABLE")).toBe(
			true,
		);
	});

	it("derives each unit's cost from its own measure (S3)", () => {
		const created = lot({ costPerMeasure: "100", measures: [1.5, 2.25] });

		expect(created.measureTotal).toBe("3.750");
		expect(created.units.map((unit) => unit.cost)).toEqual([
			"150.00",
			"225.00",
		]);
	});

	it("makes the last unit absorb the rounding difference so the sum is exact", () => {
		// 1.111 × 1234.56 = 1371.59616 → 1371.60 per unit, but three of those are
		// 4114.80 while 3.333 × 1234.56 = 4114.78848 → 4114.79. The last unit
		// carries the one-cent difference.
		const created = lot({
			costPerMeasure: "1234.56",
			measures: [1.111, 1.111, 1.111],
		});

		expect(created.measureTotal).toBe("3.333");
		expect(created.units.map((unit) => unit.cost)).toEqual([
			"1371.60",
			"1371.60",
			"1371.59",
		]);

		const totalUnitCost = created.units.reduce(
			(sum, unit) => sum + cents(unit.cost),
			0,
		);
		expect(totalUnitCost).toBe(totalCents(created.measureTotal, "1234.56"));
	});

	it("keeps the cost identity when the roundings agree", () => {
		const created = lot({
			costPerMeasure: "5650.25",
			measures: [10, 20.5, 4.25],
		});

		const totalUnitCost = created.units.reduce(
			(sum, unit) => sum + cents(unit.cost),
			0,
		);

		expect(totalUnitCost).toBe(totalCents(created.measureTotal, "5650.25"));
	});

	it("rejects an empty list of measures", () => {
		expect(() => lot({ measures: [] })).toThrow(DomainError);
		expect(() => lot({ measures: [] })).toThrow(/at least one unit/);
	});

	it.each([0, -1.5])("rejects the non-positive measure %p", (measure) => {
		expect(() => lot({ measures: [2, measure] })).toThrow(DomainError);
		expect(() => lot({ measures: [2, measure] })).toThrow(/greater than 0/);
	});

	it("rejects a unit count that does not match the units", () => {
		expect(() => lot({ measures: [1, 2], unitCount: 3 })).toThrow(DomainError);
		expect(() => lot({ measures: [1, 2], unitCount: 3 })).toThrow(/unit count/);
	});

	it.each(["0", "0.00", "-1", "abc"])(
		"rejects the invalid cost per measure %p",
		(costPerMeasure) => {
			expect(() => lot({ costPerMeasure })).toThrow(DomainError);
		},
	);

	it("rejects more than 500 units", () => {
		expect(() => lot({ measures: new Array(501).fill(1) })).toThrow(
			DomainError,
		);
	});

	it("rejects a measure with more precision than the column stores", () => {
		expect(() => lot({ measures: [1.1111] })).toThrow(DomainError);
	});

	it("normalizes a blank note to null and keeps the given one", () => {
		expect(lot({ note: "   " }).note).toBeNull();
		expect(lot({ note: "  Factura 1234  " }).note).toBe("Factura 1234");
	});

	it("defaults the received date to the moment it is registered", () => {
		const createdAt = new Date("2026-10-21T12:00:00.000Z");

		expect(lot({ createdAt }).receivedAt).toEqual(createdAt);
		expect(
			lot({ receivedAt: new Date("2026-10-20T08:30:00.000Z") }).receivedAt,
		).toEqual(new Date("2026-10-20T08:30:00.000Z"));
	});

	it("serializes the lot with its units for the contract", () => {
		const created = lot({ costPerMeasure: "100", measures: [1.5, 2.25] });

		expect(created.toJSON()).toEqual({
			id: expect.any(String),
			companyId: "company-1",
			productId: "product-1",
			supplierId: "supplier-1",
			receivedAt: expect.any(String),
			measureTotal: "3.750",
			costPerMeasure: "100.00",
			unitCount: 2,
			note: null,
			createdAt: expect.any(String),
			units: [
				{
					id: expect.any(String),
					code: "R-01",
					measure: "1.500",
					cost: "150.00",
					status: "AVAILABLE",
				},
				{
					id: expect.any(String),
					code: "R-02",
					measure: "2.250",
					cost: "225.00",
					status: "AVAILABLE",
				},
			],
		});
	});
});
