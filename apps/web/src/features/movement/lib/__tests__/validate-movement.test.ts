import {
	MAX_MOVEMENT_QUANTITY,
	MAX_MOVEMENT_REASON_LENGTH,
	normalizeReason,
	validateMovement,
} from "../validate-movement";

describe("validateMovement", () => {
	const valid = { productId: "p1", quantity: "10", reason: "" };

	it("accepts a product and a positive integer quantity", () => {
		expect(validateMovement(valid)).toEqual({});
	});

	it("accepts the boundaries of the quantity range", () => {
		expect(validateMovement({ ...valid, quantity: "1" })).toEqual({});
		expect(
			validateMovement({ ...valid, quantity: String(MAX_MOVEMENT_QUANTITY) }),
		).toEqual({});
	});

	it("requires a product", () => {
		expect(validateMovement({ ...valid, productId: "" })).toEqual({
			productId: "Seleccioná un producto.",
		});
	});

	it("requires a quantity", () => {
		expect(validateMovement({ ...valid, quantity: "" })).toEqual({
			quantity: "Ingresá la cantidad.",
		});
	});

	it("rejects a quantity that is not an integer", () => {
		const message = "Usá una cantidad entera, por ejemplo 10.";

		expect(validateMovement({ ...valid, quantity: "2.5" })).toEqual({
			quantity: message,
		});
		expect(validateMovement({ ...valid, quantity: "diez" })).toEqual({
			quantity: message,
		});
	});

	it("rejects a quantity outside 1..1.000.000", () => {
		const message = "Usá una cantidad entre 1 y 1.000.000.";

		expect(validateMovement({ ...valid, quantity: "0" })).toEqual({
			quantity: message,
		});
		expect(validateMovement({ ...valid, quantity: "-3" })).toEqual({
			quantity: message,
		});
		expect(
			validateMovement({
				...valid,
				quantity: String(MAX_MOVEMENT_QUANTITY + 1),
			}),
		).toEqual({ quantity: message });
	});

	it("rejects a reason longer than 300 characters", () => {
		expect(
			validateMovement({
				...valid,
				reason: "a".repeat(MAX_MOVEMENT_REASON_LENGTH + 1),
			}),
		).toEqual({
			reason: "Usá 300 caracteres como máximo en el motivo.",
		});
	});

	it("accepts a reason exactly at the limit", () => {
		expect(
			validateMovement({
				...valid,
				reason: "a".repeat(MAX_MOVEMENT_REASON_LENGTH),
			}),
		).toEqual({});
	});

	it("reports every invalid field at once", () => {
		expect(
			validateMovement({ productId: "", quantity: "", reason: "" }),
		).toEqual({
			productId: "Seleccioná un producto.",
			quantity: "Ingresá la cantidad.",
		});
	});
});

describe("normalizeReason", () => {
	it("trims the reason", () => {
		expect(normalizeReason("  Compra a proveedor  ")).toBe(
			"Compra a proveedor",
		);
	});

	it("sends a blank reason as null, which is how the API clears it", () => {
		expect(normalizeReason("   ")).toBeNull();
		expect(normalizeReason("")).toBeNull();
	});
});
