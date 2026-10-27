import { Product } from "../src/domain/entities/product.js";
import { DomainError } from "../src/domain/errors/domain-error.js";

function create(overrides: Partial<Parameters<typeof Product.create>[0]> = {}) {
	return Product.create({
		companyId: "company-1",
		name: "Cafe molido 500g",
		sku: "CAF-500",
		price: "1500",
		...overrides,
	});
}

describe("Product.create name", () => {
	it("trims the name", () => {
		expect(create({ name: "  Cafe molido  " }).name).toBe("Cafe molido");
	});

	it("rejects an empty or whitespace-only name", () => {
		expect(() => create({ name: "" })).toThrow(DomainError);
		expect(() => create({ name: "   " })).toThrow(DomainError);
	});

	it("accepts 120 characters and rejects 121", () => {
		expect(create({ name: "a".repeat(120) }).name).toHaveLength(120);
		expect(() => create({ name: "a".repeat(121) })).toThrow(DomainError);
	});
});

describe("Product.create price", () => {
	it("pads an integer price to two decimals", () => {
		expect(create({ price: "1500" }).price).toBe("1500.00");
	});

	it("pads and keeps a single decimal", () => {
		expect(create({ price: "7.5" }).price).toBe("7.50");
		expect(create({ price: "7.50" }).price).toBe("7.50");
		expect(create({ price: "0.5" }).price).toBe("0.50");
	});

	it("normalizes leading zeros on the integer part", () => {
		expect(create({ price: "007.5" }).price).toBe("7.50");
		expect(create({ price: "0000000000" }).price).toBe("0.00");
	});

	it("accepts the largest representable price", () => {
		expect(create({ price: "9999999999.99" }).price).toBe("9999999999.99");
	});

	it.each([
		["a negative price", "-5"],
		["more than two decimals", "7.505"],
		["a non-numeric price", "abc"],
		["a price with a thousands separator", "1,500"],
		["an empty price", ""],
		["a price without an integer part", ".5"],
		["a price with a trailing dot", "1500."],
		["a price above the column precision", "10000000000"],
	])("rejects %s", (_label, price) => {
		expect(() => create({ price })).toThrow(DomainError);
	});
});

describe("Product.create sku", () => {
	it("trims and uppercases the sku", () => {
		expect(create({ sku: "  caf-500  " }).sku).toBe("CAF-500");
	});

	it("rejects an empty sku and one longer than 64 characters", () => {
		expect(() => create({ sku: "   " })).toThrow(DomainError);
		expect(create({ sku: "a".repeat(64) }).sku).toHaveLength(64);
		expect(() => create({ sku: "a".repeat(65) })).toThrow(DomainError);
	});
});

describe("Product.create description", () => {
	it("trims the description", () => {
		expect(create({ description: "  Molido medio  " }).description).toBe(
			"Molido medio",
		);
	});

	it("normalizes an absent, empty or whitespace-only description to null", () => {
		expect(create().description).toBeNull();
		expect(create({ description: "" }).description).toBeNull();
		expect(create({ description: "   " }).description).toBeNull();
		expect(create({ description: null }).description).toBeNull();
	});

	it("rejects a description longer than 1000 characters", () => {
		expect(create({ description: "a".repeat(1000) }).description).toHaveLength(
			1000,
		);
		expect(() => create({ description: "a".repeat(1001) })).toThrow(
			DomainError,
		);
	});
});

describe("Product.create photoUrl", () => {
	it("keeps an http or https url", () => {
		expect(create({ photoUrl: "http://example.com/a.png" }).photoUrl).toBe(
			"http://example.com/a.png",
		);
		expect(create({ photoUrl: "https://example.com/a.png" }).photoUrl).toBe(
			"https://example.com/a.png",
		);
	});

	it("normalizes an absent or empty url to null", () => {
		expect(create().photoUrl).toBeNull();
		expect(create({ photoUrl: "" }).photoUrl).toBeNull();
		expect(create({ photoUrl: "   " }).photoUrl).toBeNull();
		expect(create({ photoUrl: null }).photoUrl).toBeNull();
	});

	it("rejects a non-http scheme and a value that is not a url", () => {
		expect(() => create({ photoUrl: "ftp://example.com/a.png" })).toThrow(
			DomainError,
		);
		expect(() => create({ photoUrl: "javascript:alert(1)" })).toThrow(
			DomainError,
		);
		expect(() => create({ photoUrl: "not a url" })).toThrow(DomainError);
	});

	it("rejects a url longer than 2048 characters", () => {
		const longUrl = `https://example.com/${"a".repeat(2048)}`;

		expect(() => create({ photoUrl: longUrl })).toThrow(DomainError);
	});
});

describe("Product.create server-owned fields", () => {
	it("defaults stock, low-stock threshold and category", () => {
		const product = create();

		expect(product.stockQuantity).toBe(0);
		expect(product.lowStockThreshold).toBe(0);
		expect(product.categoryId).toBeNull();
		expect(product.deletedAt).toBeNull();
	});

	it("rejects a negative or fractional stock quantity", () => {
		expect(() => create({ stockQuantity: -1 })).toThrow(DomainError);
		expect(() => create({ stockQuantity: 1.5 })).toThrow(DomainError);
	});

	it("rejects a negative or fractional low-stock threshold", () => {
		expect(() => create({ lowStockThreshold: -1 })).toThrow(DomainError);
		expect(() => create({ lowStockThreshold: 1.5 })).toThrow(DomainError);
	});
});

describe("Product.create categoryId", () => {
	it("keeps the category the caller names", () => {
		expect(create({ categoryId: "category-1" }).categoryId).toBe("category-1");
	});

	it("defaults an absent or null category to null", () => {
		expect(create().categoryId).toBeNull();
		expect(create({ categoryId: null }).categoryId).toBeNull();
	});
});

describe("Product.create measureUnit", () => {
	it("defaults an absent measure unit to KILOGRAM", () => {
		expect(create().measureUnit).toBe("KILOGRAM");
	});

	it("keeps every unit the domain knows", () => {
		expect(create({ measureUnit: "LITRE" }).measureUnit).toBe("LITRE");
		expect(create({ measureUnit: "METRE" }).measureUnit).toBe("METRE");
	});

	it("rejects a unit the domain does not know", () => {
		expect(() =>
			create({ measureUnit: "POUND" as unknown as "KILOGRAM" }),
		).toThrow(DomainError);
	});
});

describe("Product.toJSON", () => {
	it("serializes exactly the contract fields, with a decimal price and ISO dates", () => {
		const createdAt = new Date("2026-10-20T12:00:00.000Z");
		const updatedAt = new Date("2026-10-21T12:00:00.000Z");
		const product = create({
			id: "product-1",
			price: "1500",
			description: "Molido medio",
			createdAt,
			updatedAt,
		});

		expect(product.toJSON()).toEqual({
			id: "product-1",
			companyId: "company-1",
			name: "Cafe molido 500g",
			description: "Molido medio",
			sku: "CAF-500",
			price: "1500.00",
			photoUrl: null,
			stockQuantity: 0,
			lowStockThreshold: 0,
			measureUnit: "KILOGRAM",
			categoryId: null,
			createdAt: "2026-10-20T12:00:00.000Z",
			updatedAt: "2026-10-21T12:00:00.000Z",
		});
	});

	it("serializes the measure unit the product is measured in", () => {
		// L19: the purchase form needs "$ per kg" / "$ per litre" with a real
		// value, so the measure travels with every product read and write.
		expect(create({ measureUnit: "LITRE" }).toJSON().measureUnit).toBe("LITRE");
		expect(create({ measureUnit: "METRE" }).toJSON().measureUnit).toBe("METRE");
	});

	it("serializes the category the product belongs to", () => {
		// S7: the id travels with the product, and the name is resolved by the
		// read (it is not part of the product row).
		expect(create({ categoryId: "category-1" }).toJSON().categoryId).toBe(
			"category-1",
		);
	});

	it("never exposes the soft-delete timestamp", () => {
		const product = create({ deletedAt: new Date("2026-10-22T12:00:00.000Z") });

		expect(product.toJSON()).not.toHaveProperty("deletedAt");
	});
});

describe("Product.withChanges", () => {
	it("applies the changes and preserves the server-owned fields", () => {
		const createdAt = new Date("2026-10-20T12:00:00.000Z");
		const product = create({
			id: "product-1",
			createdAt,
			updatedAt: createdAt,
			stockQuantity: 12,
			lowStockThreshold: 3,
		});

		const updated = product.withChanges({
			name: "  Cafe en grano  ",
			price: "7.5",
		});

		expect(updated.id).toBe("product-1");
		expect(updated.companyId).toBe("company-1");
		expect(updated.stockQuantity).toBe(12);
		expect(updated.lowStockThreshold).toBe(3);
		expect(updated.createdAt).toEqual(createdAt);
		expect(updated.name).toBe("Cafe en grano");
		expect(updated.price).toBe("7.50");
		expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
			createdAt.getTime(),
		);
	});

	it("leaves the untouched fields as they were", () => {
		const product = create({
			description: "Molido medio",
			photoUrl: "https://example.com/a.png",
		});

		const updated = product.withChanges({ name: "Otro nombre" });

		expect(updated.sku).toBe("CAF-500");
		expect(updated.price).toBe("1500.00");
		expect(updated.description).toBe("Molido medio");
		expect(updated.photoUrl).toBe("https://example.com/a.png");
	});

	it("changes the low-stock threshold and keeps it when the change does not name it", () => {
		const product = create({ lowStockThreshold: 3 });

		expect(
			product.withChanges({ lowStockThreshold: 7 }).lowStockThreshold,
		).toBe(7);
		expect(product.withChanges({ name: "Otro nombre" }).lowStockThreshold).toBe(
			3,
		);
	});

	it("accepts an explicit zero threshold as a value, not as 'unchanged'", () => {
		const product = create({ lowStockThreshold: 3 });

		expect(
			product.withChanges({ lowStockThreshold: 0 }).lowStockThreshold,
		).toBe(0);
	});

	it("re-validates the low-stock threshold through the factory", () => {
		const product = create();

		expect(() => product.withChanges({ lowStockThreshold: -1 })).toThrow(
			DomainError,
		);
		expect(() => product.withChanges({ lowStockThreshold: 1.5 })).toThrow(
			DomainError,
		);
	});

	it("changes the measure unit and keeps it when the change does not name it", () => {
		const product = create({ measureUnit: "KILOGRAM" });

		expect(product.withChanges({ measureUnit: "LITRE" }).measureUnit).toBe(
			"LITRE",
		);
		expect(product.withChanges({ name: "Otro nombre" }).measureUnit).toBe(
			"KILOGRAM",
		);
	});

	it("changes the category and keeps it when the change does not name it", () => {
		// S7: an absent change keeps the stored category; only an explicit id
		// moves the product to another one.
		const product = create({ categoryId: "category-1" });

		expect(product.withChanges({ categoryId: "category-2" }).categoryId).toBe(
			"category-2",
		);
		expect(product.withChanges({ name: "Otro nombre" }).categoryId).toBe(
			"category-1",
		);
	});

	it("clears the category when null is passed explicitly", () => {
		const product = create({ categoryId: "category-1" });

		expect(product.withChanges({ categoryId: null }).categoryId).toBeNull();
	});

	it("clears description and photoUrl when null is passed explicitly", () => {
		const product = create({
			description: "Molido medio",
			photoUrl: "https://example.com/a.png",
		});

		const updated = product.withChanges({
			description: null,
			photoUrl: null,
		});

		expect(updated.description).toBeNull();
		expect(updated.photoUrl).toBeNull();
	});

	it("re-validates the changed fields", () => {
		const product = create();

		expect(() => product.withChanges({ name: "   " })).toThrow(DomainError);
		expect(() => product.withChanges({ price: "7.505" })).toThrow(DomainError);
	});
});

describe("Product.withStock", () => {
	it("changes only the stock and preserves every other field", () => {
		const created = create({
			id: "product-1",
			description: "Molido medio",
			photoUrl: "https://example.com/a.png",
			stockQuantity: 5,
			lowStockThreshold: 2,
			deletedAt: new Date("2026-10-22T12:00:00.000Z"),
		});

		const restocked = created.withStock(15);

		expect(restocked.stockQuantity).toBe(15);
		expect({
			...restocked.toJSON(),
			stockQuantity: created.stockQuantity,
		}).toEqual(created.toJSON());
		expect(restocked.deletedAt).toBe(created.deletedAt);
		expect(restocked.updatedAt).toBe(created.updatedAt);
	});

	it("accepts zero and rejects a negative or fractional quantity", () => {
		expect(create({ stockQuantity: 5 }).withStock(0).stockQuantity).toBe(0);
		expect(() => create().withStock(-1)).toThrow(DomainError);
		expect(() => create().withStock(1.5)).toThrow(DomainError);
	});
});
