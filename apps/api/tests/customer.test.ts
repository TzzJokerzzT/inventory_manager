import { Customer } from "../src/domain/entities/customer.js";
import { DomainError } from "../src/domain/errors/domain-error.js";

function create(
	overrides: Partial<Parameters<typeof Customer.create>[0]> = {},
): Customer {
	return Customer.create({
		companyId: "company-1",
		name: "Maria Gonzalez",
		...overrides,
	});
}

describe("Customer.create name", () => {
	it("trims the name", () => {
		expect(create({ name: "  Maria Gonzalez  " }).name).toBe("Maria Gonzalez");
	});

	it("rejects an empty or whitespace-only name", () => {
		expect(() => create({ name: "" })).toThrow(DomainError);
		expect(() => create({ name: "   " })).toThrow(DomainError);
	});

	it("accepts 120 characters and rejects 121", () => {
		expect(create({ name: "a".repeat(120) }).name).toHaveLength(120);
		expect(() => create({ name: "a".repeat(121) })).toThrow(DomainError);
	});

	it("rejects an empty company id", () => {
		expect(() => create({ companyId: "   " })).toThrow(DomainError);
	});
});

describe("Customer.create email", () => {
	it("trims and lowercases the email", () => {
		expect(create({ email: "  Maria.Gonzalez@Example.COM  " }).email).toBe(
			"maria.gonzalez@example.com",
		);
	});

	it("normalizes an absent, empty or whitespace-only email to null", () => {
		expect(create().email).toBeNull();
		expect(create({ email: "" }).email).toBeNull();
		expect(create({ email: "   " }).email).toBeNull();
		expect(create({ email: null }).email).toBeNull();
	});

	it.each([
		["a value without an at sign", "maria.example.com"],
		["a value without a domain dot", "maria@example"],
		["a value with a space inside", "maria gonzalez@example.com"],
		["a value without a local part", "@example.com"],
		["a value without a domain", "maria@"],
		["a value with two at signs", "maria@@example.com"],
	])("rejects %s", (_label, email) => {
		expect(() => create({ email })).toThrow(DomainError);
	});

	it("accepts 254 characters and rejects 255", () => {
		const domain = "@ex.com";
		const at254 = `${"a".repeat(254 - domain.length)}${domain}`;
		const at255 = `${"a".repeat(255 - domain.length)}${domain}`;

		expect(create({ email: at254 }).email).toHaveLength(254);
		expect(() => create({ email: at255 })).toThrow(DomainError);
	});
});

describe("Customer.create phone", () => {
	it("trims the phone", () => {
		expect(create({ phone: "  +54 11 5555-1234  " }).phone).toBe(
			"+54 11 5555-1234",
		);
	});

	it("normalizes an absent, empty or whitespace-only phone to null", () => {
		expect(create().phone).toBeNull();
		expect(create({ phone: "" }).phone).toBeNull();
		expect(create({ phone: "   " }).phone).toBeNull();
		expect(create({ phone: null }).phone).toBeNull();
	});

	it("accepts digits and the punctuation a phone is written with", () => {
		expect(create({ phone: "+1 (555) 123-4567" }).phone).toBe(
			"+1 (555) 123-4567",
		);
		expect(create({ phone: "555.123.4567" }).phone).toBe("555.123.4567");
	});

	it.each([
		["a letter", "555-CALL-NOW"],
		["an underscore", "555_1234"],
		["a slash", "555/1234"],
		["an emoji", "555😀"],
	])("rejects %s", (_label, phone) => {
		expect(() => create({ phone })).toThrow(DomainError);
	});

	it("accepts 40 characters and rejects 41", () => {
		expect(create({ phone: "1".repeat(40) }).phone).toHaveLength(40);
		expect(() => create({ phone: "1".repeat(41) })).toThrow(DomainError);
	});
});

describe("Customer.create address", () => {
	it("trims the address", () => {
		expect(create({ address: "  Av. Siempre Viva 742  " }).address).toBe(
			"Av. Siempre Viva 742",
		);
	});

	it("normalizes an absent, empty or whitespace-only address to null", () => {
		expect(create().address).toBeNull();
		expect(create({ address: "" }).address).toBeNull();
		expect(create({ address: "   " }).address).toBeNull();
		expect(create({ address: null }).address).toBeNull();
	});

	it("accepts 300 characters and rejects 301", () => {
		expect(create({ address: "a".repeat(300) }).address).toHaveLength(300);
		expect(() => create({ address: "a".repeat(301) })).toThrow(DomainError);
	});
});

describe("Customer.create identity and timestamps", () => {
	it("defaults the id, the soft-delete stamp and the timestamps", () => {
		const customer = create();

		expect(customer.id).toEqual(expect.any(String));
		expect(customer.deletedAt).toBeNull();
		expect(customer.createdAt).toBeInstanceOf(Date);
		expect(customer.updatedAt).toBeInstanceOf(Date);
	});
});

describe("Customer.toJSON", () => {
	it("serializes exactly the contract fields", () => {
		const createdAt = new Date("2026-10-20T12:00:00.000Z");
		const updatedAt = new Date("2026-10-21T12:00:00.000Z");
		const customer = create({
			id: "customer-1",
			email: "Maria@Example.com",
			phone: "+54 11 5555-1234",
			address: "Av. Siempre Viva 742",
			createdAt,
			updatedAt,
		});

		expect(customer.toJSON()).toEqual({
			id: "customer-1",
			companyId: "company-1",
			name: "Maria Gonzalez",
			email: "maria@example.com",
			phone: "+54 11 5555-1234",
			address: "Av. Siempre Viva 742",
			createdAt: "2026-10-20T12:00:00.000Z",
			updatedAt: "2026-10-21T12:00:00.000Z",
		});
	});

	it("never exposes the soft-delete timestamp", () => {
		const customer = create({
			deletedAt: new Date("2026-10-22T12:00:00.000Z"),
		});

		expect(customer.toJSON()).not.toHaveProperty("deletedAt");
	});
});

describe("Customer.withChanges", () => {
	it("preserves the identity and the creation timestamp", () => {
		const createdAt = new Date("2026-10-20T12:00:00.000Z");
		const customer = create({
			id: "customer-1",
			createdAt,
			updatedAt: createdAt,
		});

		const updated = customer.withChanges({ name: "  Maria G.  " });

		expect(updated.id).toBe("customer-1");
		expect(updated.companyId).toBe("company-1");
		expect(updated.createdAt).toEqual(createdAt);
		expect(updated.name).toBe("Maria G.");
		expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
			createdAt.getTime(),
		);
	});

	it("keeps the untouched contact fields", () => {
		const customer = create({
			email: "maria@example.com",
			phone: "+54 11 5555-1234",
			address: "Av. Siempre Viva 742",
		});

		const updated = customer.withChanges({ name: "Maria G." });

		expect(updated.email).toBe("maria@example.com");
		expect(updated.phone).toBe("+54 11 5555-1234");
		expect(updated.address).toBe("Av. Siempre Viva 742");
	});

	it("clears a contact field with an explicit null", () => {
		const customer = create({
			email: "maria@example.com",
			phone: "+54 11 5555-1234",
			address: "Av. Siempre Viva 742",
		});

		const updated = customer.withChanges({
			email: null,
			phone: null,
			address: null,
		});

		expect(updated.email).toBeNull();
		expect(updated.phone).toBeNull();
		expect(updated.address).toBeNull();
	});

	it("normalizes an empty string to null, clearing the field too", () => {
		const customer = create({
			email: "maria@example.com",
			phone: "+54 11 5555-1234",
			address: "Av. Siempre Viva 742",
		});

		const updated = customer.withChanges({
			email: "   ",
			phone: "",
			address: "  ",
		});

		expect(updated.email).toBeNull();
		expect(updated.phone).toBeNull();
		expect(updated.address).toBeNull();
	});

	it("re-validates the changed fields", () => {
		const customer = create();

		expect(() => customer.withChanges({ name: "   " })).toThrow(DomainError);
		expect(() => customer.withChanges({ email: "nope" })).toThrow(DomainError);
		expect(() => customer.withChanges({ phone: "call me" })).toThrow(
			DomainError,
		);
		expect(() => customer.withChanges({ address: "a".repeat(301) })).toThrow(
			DomainError,
		);
	});
});
