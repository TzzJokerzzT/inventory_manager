import { Category } from "../src/domain/entities/category.js";
import { DomainError } from "../src/domain/errors/domain-error.js";

function create(
	overrides: Partial<Parameters<typeof Category.create>[0]> = {},
): Category {
	return Category.create({
		companyId: "company-1",
		name: "Bebidas",
		...overrides,
	});
}

describe("Category.create name", () => {
	it("trims the name", () => {
		expect(create({ name: "  Bebidas  " }).name).toBe("Bebidas");
	});

	it("rejects an empty or whitespace-only name", () => {
		expect(() => create({ name: "" })).toThrow(DomainError);
		expect(() => create({ name: "   " })).toThrow(DomainError);
	});

	it("accepts 120 characters and rejects 121", () => {
		expect(create({ name: "a".repeat(120) }).name).toHaveLength(120);
		expect(() => create({ name: "a".repeat(121) })).toThrow(DomainError);
	});

	it("keeps the case of the name, because uniqueness is case-sensitive", () => {
		// The `@@unique([companyId, name])` index is case-sensitive, so `Bebidas`
		// and `bebidas` are two different categories and the entity must not fold
		// either of them.
		expect(create({ name: "Bebidas Sin Alcohol" }).name).toBe(
			"Bebidas Sin Alcohol",
		);
		expect(create({ name: "bebidas" }).name).toBe("bebidas");
	});

	it("rejects an empty company id", () => {
		expect(() => create({ companyId: "   " })).toThrow(DomainError);
	});
});

describe("Category.create defaults", () => {
	it("generates an id and the timestamps", () => {
		const category = create();

		expect(category.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(category.companyId).toBe("company-1");
		expect(category.createdAt).toBeInstanceOf(Date);
		expect(category.updatedAt).toBeInstanceOf(Date);
	});
});

describe("Category.withChanges", () => {
	it("keeps the identity and the creation date", () => {
		const original = create({
			id: "category-1",
			createdAt: new Date("2026-10-01T10:00:00.000Z"),
			updatedAt: new Date("2026-10-01T10:00:00.000Z"),
		});

		const changed = original.withChanges({ name: "  Almacén  " });

		expect(changed.id).toBe("category-1");
		expect(changed.companyId).toBe("company-1");
		expect(changed.name).toBe("Almacén");
		expect(changed.createdAt).toBe(original.createdAt);
		expect(changed.updatedAt.getTime()).toBeGreaterThan(
			original.updatedAt.getTime(),
		);
	});

	it("keeps the name when no change is given, and re-validates a rejected one", () => {
		const original = create({ name: "Bebidas" });

		expect(original.withChanges({}).name).toBe("Bebidas");
		expect(() => original.withChanges({ name: "   " })).toThrow(DomainError);
	});
});

describe("Category.toJSON", () => {
	it("renders the contract shape with ISO timestamps and nothing else", () => {
		const category = create({
			id: "category-1",
			createdAt: new Date("2026-10-01T10:00:00.000Z"),
			updatedAt: new Date("2026-10-02T10:00:00.000Z"),
		});

		expect(category.toJSON()).toEqual({
			id: "category-1",
			companyId: "company-1",
			name: "Bebidas",
			createdAt: "2026-10-01T10:00:00.000Z",
			updatedAt: "2026-10-02T10:00:00.000Z",
		});
	});
});
