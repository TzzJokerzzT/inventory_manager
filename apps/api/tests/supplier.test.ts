import { Supplier } from "../src/domain/entities/supplier.js";
import { DomainError } from "../src/domain/errors/domain-error.js";

function create(
	overrides: Partial<Parameters<typeof Supplier.create>[0]> = {},
): Supplier {
	return Supplier.create({
		companyId: "company-1",
		name: "Distribuidora Sur",
		...overrides,
	});
}

describe("Supplier.create name", () => {
	it("trims the name", () => {
		expect(create({ name: "  Distribuidora Sur  " }).name).toBe(
			"Distribuidora Sur",
		);
	});

	it("rejects an empty or whitespace-only name", () => {
		expect(() => create({ name: "" })).toThrow(DomainError);
		expect(() => create({ name: "   " })).toThrow(DomainError);
	});

	it("accepts 120 characters and rejects 121", () => {
		expect(create({ name: "a".repeat(120) }).name).toHaveLength(120);
		expect(() => create({ name: "a".repeat(121) })).toThrow(DomainError);
	});

	it("keeps the case of the name, because it is display text", () => {
		// Unlike `Product.sku`, the name is read back by a human, so it is not
		// case-folded; uniqueness is case-sensitive exactly like the index.
		expect(create({ name: "Distribuidora SUR" }).name).toBe(
			"Distribuidora SUR",
		);
	});

	it("rejects an empty company id", () => {
		expect(() => create({ companyId: "   " })).toThrow(DomainError);
	});
});

describe("Supplier.create contact", () => {
	it("trims the contact", () => {
		expect(create({ contact: "  Juan Perez +54 11 5555-1234  " }).contact).toBe(
			"Juan Perez +54 11 5555-1234",
		);
	});

	it("normalizes an absent, null, empty or whitespace-only contact to null", () => {
		expect(create().contact).toBeNull();
		expect(create({ contact: null }).contact).toBeNull();
		expect(create({ contact: "" }).contact).toBeNull();
		expect(create({ contact: "   " }).contact).toBeNull();
	});
});

describe("Supplier.create defaults", () => {
	it("generates an id and the timestamps, and starts active", () => {
		const supplier = create();

		expect(supplier.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(supplier.companyId).toBe("company-1");
		expect(supplier.deletedAt).toBeNull();
		expect(supplier.createdAt).toBeInstanceOf(Date);
		expect(supplier.updatedAt).toBeInstanceOf(Date);
	});
});

describe("Supplier.withChanges", () => {
	it("keeps the untouched fields and the identity", () => {
		const original = create({
			id: "supplier-1",
			contact: "Juan Perez",
			createdAt: new Date("2026-10-01T10:00:00.000Z"),
			updatedAt: new Date("2026-10-01T10:00:00.000Z"),
		});

		const changed = original.withChanges({ name: "  Distribuidora Norte  " });

		expect(changed.id).toBe("supplier-1");
		expect(changed.companyId).toBe("company-1");
		expect(changed.name).toBe("Distribuidora Norte");
		expect(changed.contact).toBe("Juan Perez");
		expect(changed.createdAt).toBe(original.createdAt);
		expect(changed.updatedAt.getTime()).toBeGreaterThan(
			original.updatedAt.getTime(),
		);
	});

	it.each([
		["null", null],
		["the empty string", ""],
		["whitespace", "   "],
	])("clears the contact with %s", (_label, contact) => {
		const original = create({ contact: "Juan Perez" });

		expect(original.withChanges({ contact }).contact).toBeNull();
	});

	it("keeps the soft-delete stamp it already had", () => {
		const deletedAt = new Date("2026-10-22T12:00:00.000Z");
		const deleted = create({ deletedAt });

		expect(deleted.withChanges({ name: "Otra" }).deletedAt).toBe(deletedAt);
	});
});

describe("Supplier.toJSON", () => {
	it("renders the contract shape with ISO timestamps and no soft-delete stamp", () => {
		const supplier = create({
			id: "supplier-1",
			contact: "Juan Perez",
			createdAt: new Date("2026-10-01T10:00:00.000Z"),
			updatedAt: new Date("2026-10-02T10:00:00.000Z"),
		});

		expect(supplier.toJSON()).toEqual({
			id: "supplier-1",
			companyId: "company-1",
			name: "Distribuidora Sur",
			contact: "Juan Perez",
			createdAt: "2026-10-01T10:00:00.000Z",
			updatedAt: "2026-10-02T10:00:00.000Z",
		});
	});
});
