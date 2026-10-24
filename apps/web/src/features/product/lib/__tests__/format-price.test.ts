import { formatPrice } from "../format-price";

describe("formatPrice", () => {
	it("renders an es-AR amount from the decimal string", () => {
		expect(formatPrice("1500.00")).toBe("$ 1.500,00");
	});

	it("pads a whole amount to two decimals", () => {
		expect(formatPrice("1200")).toBe("$ 1.200,00");
		expect(formatPrice("99.5")).toBe("$ 99,50");
	});

	it("groups millions", () => {
		expect(formatPrice("1234567.89")).toBe("$ 1.234.567,89");
	});

	it("leaves a cent amount ungrouped", () => {
		expect(formatPrice("0.00")).toBe("$ 0,00");
	});

	it("keeps the sign of a negative amount", () => {
		// El margen por unidad y el de una venta pueden ser negativos (L26): el
		// signo es información que el usuario tiene que ver, no un error de
		// formato que se descarte.
		expect(formatPrice("-20500.00")).toBe("-$ 20.500,00");
		expect(formatPrice("-1500")).toBe("-$ 1.500,00");
		expect(formatPrice("-0.50")).toBe("-$ 0,50");
	});

	it("shows a value the contract does not allow without crashing", () => {
		expect(formatPrice("—")).toBe("$ —");
	});
});
