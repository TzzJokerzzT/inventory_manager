import {
	normalizeProviderName,
	toNullableProviderContact,
	validateProvider,
} from "../validate-provider";

describe("validateProvider", () => {
	it("accepts a name and an empty optional contact", () => {
		expect(
			validateProvider({ name: "Plásticos del Sur", contact: "" }),
		).toEqual({});
	});

	it("reports a blank name", () => {
		expect(validateProvider({ name: "   ", contact: "" }).name).toBe(
			"Ingresá el nombre del proveedor.",
		);
	});

	it("reports a name over the 120 the API accepts", () => {
		const errors = validateProvider({ name: "a".repeat(121), contact: "" });

		expect(errors.name).toBe(
			"Usá 120 caracteres como máximo en el nombre del proveedor.",
		);
	});

	it("reports a contact over the 120 the API accepts", () => {
		const errors = validateProvider({
			name: "Plásticos del Sur",
			contact: "a".repeat(121),
		});

		expect(errors.contact).toBe(
			"Usá 120 caracteres como máximo en el contacto.",
		);
	});

	it("measures length on the trimmed value, like the server", () => {
		expect(
			validateProvider({ name: `  ${"a".repeat(120)}  `, contact: "" }),
		).toEqual({});
	});
});

describe("normalizeProviderName", () => {
	it("trims the name, which is the shape the API stores", () => {
		expect(normalizeProviderName("  Plásticos del Sur  ")).toBe(
			"Plásticos del Sur",
		);
	});
});

describe("toNullableProviderContact", () => {
	it("keeps a real contact trimmed", () => {
		expect(toNullableProviderContact("  Ana Gómez  ")).toBe("Ana Gómez");
	});

	it("sends null for a blank contact, which is how the API clears it", () => {
		expect(toNullableProviderContact("   ")).toBeNull();
		expect(toNullableProviderContact("")).toBeNull();
	});
});
