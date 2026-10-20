import {
	normalizePrice,
	normalizeSku,
	toNullableDescription,
	validateProduct,
	validateProductPhoto,
} from "../validate-product";

const valid = {
	name: "Café molido 500g",
	sku: "CAF-500",
	price: "1500.00",
	description: "Molido medio",
};

describe("validateProduct", () => {
	it("accepts a complete product", () => {
		expect(validateProduct(valid)).toEqual({});
	});

	it("accepts an empty description", () => {
		expect(validateProduct({ ...valid, description: "" })).toEqual({});
	});

	it("reports an empty name without reaching the API", () => {
		expect(validateProduct({ ...valid, name: "   " }).name).toBe(
			"Ingresá el nombre del producto.",
		);
	});

	it("reports a name longer than 120 characters", () => {
		expect(validateProduct({ ...valid, name: "a".repeat(121) }).name).toBe(
			"Usá 120 caracteres como máximo en el nombre.",
		);
	});

	it("accepts a name of exactly 120 characters", () => {
		expect(validateProduct({ ...valid, name: "a".repeat(120) }).name).toBe(
			undefined,
		);
	});

	it("reports an empty sku", () => {
		expect(validateProduct({ ...valid, sku: " " }).sku).toBe(
			"Ingresá el código SKU.",
		);
	});

	it("reports a sku longer than 64 characters", () => {
		expect(validateProduct({ ...valid, sku: "a".repeat(65) }).sku).toBe(
			"Usá 64 caracteres como máximo en el SKU.",
		);
	});

	it("reports an empty price", () => {
		expect(validateProduct({ ...valid, price: "" }).price).toBe(
			"Ingresá el precio unitario.",
		);
	});

	it("reports a price that is not a decimal number", () => {
		expect(validateProduct({ ...valid, price: "mil quinientos" }).price).toBe(
			"Usá un número con hasta dos decimales, por ejemplo 1500.00.",
		);
	});

	it("reports an es-AR comma instead of a dot", () => {
		expect(validateProduct({ ...valid, price: "1500,00" }).price).toBe(
			"Usá un número con hasta dos decimales, por ejemplo 1500.00.",
		);
	});

	it("reports more than two decimals", () => {
		expect(validateProduct({ ...valid, price: "1500.001" }).price).toBe(
			"Usá un número con hasta dos decimales, por ejemplo 1500.00.",
		);
	});

	it("reports a negative price", () => {
		expect(validateProduct({ ...valid, price: "-1500" }).price).toBe(
			"Usá un número con hasta dos decimales, por ejemplo 1500.00.",
		);
	});

	it("reports a description longer than 1000 characters", () => {
		expect(
			validateProduct({ ...valid, description: "a".repeat(1001) }).description,
		).toBe("Usá 1000 caracteres como máximo en la descripción.");
	});

	it("reports every invalid field at once", () => {
		const errors = validateProduct({
			name: "",
			sku: "",
			price: "",
			description: "a".repeat(1001),
		});

		expect(Object.keys(errors).sort()).toEqual([
			"description",
			"name",
			"price",
			"sku",
		]);
	});
});

describe("normalizePrice", () => {
	it("completes a whole amount to the two decimals the API stores", () => {
		expect(normalizePrice("1500")).toBe("1500.00");
	});

	it("completes a single decimal", () => {
		expect(normalizePrice("1500.5")).toBe("1500.50");
	});

	it("trims the value around the number", () => {
		expect(normalizePrice("  1500.25  ")).toBe("1500.25");
	});
});

describe("normalizeSku", () => {
	it("trims and uppercases, matching the server", () => {
		expect(normalizeSku("  caf-500  ")).toBe("CAF-500");
	});
});

describe("toNullableDescription", () => {
	it("sends null for a blank description so the API clears it", () => {
		expect(toNullableDescription("   ")).toBeNull();
	});

	it("keeps and trims a real description", () => {
		expect(toNullableDescription("  Molido medio  ")).toBe("Molido medio");
	});
});

describe("validateProductPhoto", () => {
	function image(name: string, type: string, size: number) {
		const file = new File([new Uint8Array(1)], name, { type });
		// jsdom keeps the real byte length; the size the rule reads is overridden.
		Object.defineProperty(file, "size", { value: size });
		return file;
	}

	it("accepts a 5 MiB JPEG", () => {
		expect(
			validateProductPhoto(image("foto.jpg", "image/jpeg", 5 * 1024 * 1024)),
		).toBeNull();
	});

	it("rejects an image over 5 MiB", () => {
		expect(
			validateProductPhoto(
				image("foto.jpg", "image/jpeg", 5 * 1024 * 1024 + 1),
			),
		).toBe("La foto no puede superar los 5 MB.");
	});

	it("rejects a GIF", () => {
		expect(validateProductPhoto(image("foto.gif", "image/gif", 1024))).toBe(
			"La foto debe ser JPG, PNG o WebP.",
		);
	});

	it("rejects a non-image file", () => {
		expect(
			validateProductPhoto(image("contrato.pdf", "application/pdf", 1024)),
		).toBe("La foto debe ser JPG, PNG o WebP.");
	});
});
