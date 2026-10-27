import { normalizeCategoryName, validateCategory } from "../validate-category";

describe("validateCategory", () => {
	it("accepts a name", () => {
		expect(validateCategory({ name: "Bebidas" })).toEqual({});
	});

	it("reports a blank name", () => {
		expect(validateCategory({ name: "   " }).name).toBe(
			"Ingresá el nombre de la categoría.",
		);
	});

	it("reports a name over the 120 the API accepts", () => {
		const errors = validateCategory({ name: "a".repeat(121) });

		expect(errors.name).toBe(
			"Usá 120 caracteres como máximo en el nombre de la categoría.",
		);
	});

	it("measures length on the trimmed value, like the server", () => {
		expect(validateCategory({ name: `  ${"a".repeat(120)}  ` })).toEqual({});
	});
});

describe("normalizeCategoryName", () => {
	it("trims the name, which is the shape the API stores", () => {
		expect(normalizeCategoryName("  Bebidas  ")).toBe("Bebidas");
	});
});
