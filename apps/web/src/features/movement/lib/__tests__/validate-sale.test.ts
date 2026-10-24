import { validateSale } from "../validate-sale";

describe("validateSale", () => {
	it("accepts a sale with units and a written price", () => {
		expect(validateSale({ unitIds: ["u1"], unitPrice: "1800.50" })).toEqual({});
	});

	it("requires at least one unit", () => {
		const errors = validateSale({ unitIds: [], unitPrice: "1800.50" });

		expect(errors.unitIds).toBe("Elegí al menos una unidad para la venta.");
	});

	it("requires the written price", () => {
		expect(validateSale({ unitIds: ["u1"], unitPrice: "" }).unitPrice).toBe(
			"Ingresá el precio de venta.",
		);
		expect(validateSale({ unitIds: ["u1"], unitPrice: "   " }).unitPrice).toBe(
			"Ingresá el precio de venta.",
		);
	});

	it("rejects a price that is zero, negative or not a decimal", () => {
		for (const price of ["0", "0.00", "-5", "mil", "1.234", "1e3"]) {
			expect(
				validateSale({ unitIds: ["u1"], unitPrice: price }).unitPrice,
			).toBe("Usá un precio mayor que cero, con hasta 2 decimales.");
		}
	});

	it("reports every invalid field at once", () => {
		const errors = validateSale({ unitIds: [], unitPrice: "" });

		expect(Object.keys(errors).sort()).toEqual(["unitIds", "unitPrice"]);
	});
});
