import { StockMovement } from "../src/domain/entities/stock-movement.js";
import { DomainError } from "../src/domain/errors/domain-error.js";

const CREATED_AT = new Date("2026-10-21T12:00:00.000Z");

type CreateInput = Parameters<typeof StockMovement.create>[0];

function movement(overrides: Partial<CreateInput> = {}): StockMovement {
	return StockMovement.create({
		companyId: "company-1",
		productId: "product-1",
		userId: "user-1",
		type: "IN",
		quantity: 10,
		createdAt: CREATED_AT,
		...overrides,
	});
}

describe("StockMovement.create", () => {
	it("builds the movement with the given fields", () => {
		const created = movement({ reason: "Compra a proveedor" });

		expect(created).toMatchObject({
			companyId: "company-1",
			productId: "product-1",
			userId: "user-1",
			type: "IN",
			quantity: 10,
			reason: "Compra a proveedor",
			createdAt: CREATED_AT,
		});
		expect(created.id).toEqual(expect.any(String));
	});

	it("accepts OUT as the exit direction", () => {
		expect(movement({ type: "OUT" }).type).toBe("OUT");
	});

	it("stamps createdAt server-side when the caller does not supply one", () => {
		const before = Date.now();
		const created = movement({ createdAt: undefined });
		const after = Date.now();

		expect(created.createdAt.getTime()).toBeGreaterThanOrEqual(before);
		expect(created.createdAt.getTime()).toBeLessThanOrEqual(after);
	});

	it.each([
		["IN", 1],
		["IN", 1_000_000],
		["OUT", 1],
	])(
		"accepts quantity %s %i, the boundaries of the range",
		(type, quantity) => {
			expect(movement({ type: type as "IN" | "OUT", quantity }).quantity).toBe(
				quantity,
			);
		},
	);

	it.each([
		["zero", 0],
		["negative", -1],
		["fractional", 1.5],
		["above the maximum", 1_000_001],
		["not a number", Number.NaN],
	])("rejects a quantity that is %s", (_label, quantity) => {
		expect(() => movement({ quantity })).toThrow(DomainError);
	});

	it.each([["in"], ["ADJUST"], ["entrada"], [""]])(
		"rejects the type %p",
		(type) => {
			expect(() => movement({ type: type as never })).toThrow(DomainError);
		},
	);

	it("defaults customerId to null, so an anonymous movement is the default", () => {
		expect(movement().customerId).toBeNull();
	});

	it("keeps the customerId of an exit, trimmed", () => {
		expect(movement({ customerId: "  customer-1  " }).customerId).toBe(
			"customer-1",
		);
	});

	it.each([[""], ["   "], [null], [undefined]])(
		"normalizes the customerId %p to null",
		(customerId) => {
			expect(movement({ customerId }).customerId).toBeNull();
		},
	);

	it("trims the reason", () => {
		expect(movement({ reason: "  Compra a proveedor  " }).reason).toBe(
			"Compra a proveedor",
		);
	});

	it.each([[""], ["   "], [null], [undefined]])(
		"normalizes the reason %p to null",
		(reason) => {
			expect(movement({ reason }).reason).toBeNull();
		},
	);

	it("accepts a reason of exactly 300 characters and rejects 301", () => {
		expect(movement({ reason: "a".repeat(300) }).reason).toHaveLength(300);
		expect(() => movement({ reason: "a".repeat(301) })).toThrow(DomainError);
	});

	it.each([
		["company id", { companyId: "" }],
		["company id with blanks", { companyId: "   " }],
		["product id", { productId: "" }],
		["user id", { userId: "" }],
		["id", { id: "" }],
	])("rejects an empty %s", (_label, overrides) => {
		expect(() => movement(overrides as Partial<CreateInput>)).toThrow(
			DomainError,
		);
	});
});

describe("StockMovement.toJSON", () => {
	it("returns only the movement fields, with the date as ISO", () => {
		const json = movement({ reason: "Compra" }).toJSON();

		expect(json).toEqual({
			id: expect.any(String),
			companyId: "company-1",
			productId: "product-1",
			type: "IN",
			quantity: 10,
			reason: "Compra",
			userId: "user-1",
			customerId: null,
			createdAt: "2026-10-21T12:00:00.000Z",
		});
		// The product, the actor and the resolved customer are the view's
		// business, not the entity's.
		expect(json).not.toHaveProperty("product");
		expect(json).not.toHaveProperty("actor");
		expect(json).not.toHaveProperty("customer");
	});
});

describe("StockMovement immutability", () => {
	it("exposes no mutator: every field is a getter without a setter", () => {
		for (const field of [
			"id",
			"companyId",
			"productId",
			"type",
			"quantity",
			"reason",
			"userId",
			"customerId",
			"createdAt",
		]) {
			const descriptor = Object.getOwnPropertyDescriptor(
				StockMovement.prototype,
				field,
			);
			expect(descriptor?.get).toEqual(expect.any(Function));
			expect(descriptor?.set).toBeUndefined();
		}
	});
});
