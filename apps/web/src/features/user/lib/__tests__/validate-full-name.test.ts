import { MAX_FULL_NAME_LENGTH, validateFullName } from "../validate-full-name";

describe("validateFullName", () => {
	it("rejects an empty name", () => {
		expect(validateFullName("")).toBe("Ingresá tu nombre completo.");
	});

	it("rejects a whitespace-only name", () => {
		expect(validateFullName("   \t\n ")).toBe("Ingresá tu nombre completo.");
	});

	it("accepts a name with surrounding spaces", () => {
		expect(validateFullName("  Ana Pérez  ")).toBeNull();
	});

	it("accepts a name at the length limit", () => {
		expect(validateFullName("a".repeat(MAX_FULL_NAME_LENGTH))).toBeNull();
	});

	it("rejects a name past the length limit", () => {
		expect(validateFullName("a".repeat(MAX_FULL_NAME_LENGTH + 1))).toBe(
			"Usá 120 caracteres como máximo.",
		);
	});

	it("measures the length after trimming", () => {
		const atLimitAfterTrim = `  ${"a".repeat(MAX_FULL_NAME_LENGTH)}  `;

		expect(atLimitAfterTrim.length).toBeGreaterThan(MAX_FULL_NAME_LENGTH);
		expect(validateFullName(atLimitAfterTrim)).toBeNull();
	});
});
