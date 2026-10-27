import * as v from "valibot";

/**
 * `price` travels as a **string**, not a number (L5): the column is
 * `Decimal(12,2)` and a float would lose precision at the first rounding. The
 * regex is the frozen one from the OpenAPI contract.
 */
const priceSchema = v.pipe(
	v.string(),
	v.regex(
		/^\d{1,10}(\.\d{1,2})?$/,
		"price must be a decimal string with up to ten integer digits and up to two decimals",
	),
);

const nameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "name must not be empty"),
	v.maxLength(120, "name must be at most 120 characters"),
);

const skuSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "sku must not be empty"),
	v.maxLength(64, "sku must be at most 64 characters"),
);

const descriptionSchema = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(1000, "description must be at most 1000 characters"),
);

/**
 * Only `http`/`https` urls are accepted: the web client renders this value as
 * an `<img>` source. The empty string is valid here because the domain
 * normalizes it to `null`, the same as an absent field.
 */
const photoUrlSchema = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(2048, "photoUrl must be at most 2048 characters"),
	v.check((value) => {
		if (value.length === 0) {
			return true;
		}

		try {
			const url = new URL(value);
			return url.protocol === "http:" || url.protocol === "https:";
		} catch {
			return false;
		}
	}, "photoUrl must be a valid http or https url"),
);

/**
 * The measure units the contract allows, spelled out here as the boundary's
 * closed list (L19). A value outside it is a client mistake and answers 400 with
 * the issue list, instead of reaching the entity and surfacing as a 422.
 */
const measureUnitSchema = v.picklist(
	["KILOGRAM", "LITRE", "METRE"],
	"measureUnit must be one of KILOGRAM, LITRE, METRE",
);

/**
 * The category of a product (S7). It travels as the id the category endpoints
 * answer, never as a name: the write validates that the category exists in the
 * same company and the read resolves the name, so the two never drift.
 *
 * The format is checked here so a malformed id is a 400 with the issue list and
 * never a lookup that could probe another company's ids.
 */
const categoryIdSchema = v.pipe(
	v.string(),
	v.uuid("categoryId must be a uuid"),
);

/**
 * Request schema for `POST /companies/:companyId/products`.
 *
 * Only the creatable fields exist here: `stockQuantity` and
 * `lowStockThreshold` are server-owned (MI-8, MI-12), so valibot drops them
 * from the parsed output instead of letting an unknown key reach the use case.
 * `categoryId` is writable since S7.
 */
export const createProductSchema = v.object({
	name: nameSchema,
	sku: skuSchema,
	price: priceSchema,
	description: v.optional(v.nullable(descriptionSchema)),
	photoUrl: v.optional(v.nullable(photoUrlSchema)),
	// Absent keeps the column's default (KILOGRAM), which is what a product
	// created before the purchase lots carries.
	measureUnit: v.optional(measureUnitSchema),
	// Absent means "no category", which is the column's default (`null`).
	categoryId: v.optional(v.nullable(categoryIdSchema)),
});

/**
 * Request schema for `PATCH /companies/:companyId/products/:productId`.
 *
 * Every field is optional and its absence means "unchanged", while an explicit
 * `null` clears `description`, `photoUrl` or `categoryId` -- that is why the
 * fields are `optional(nullable(...))` and not `optional(..., null)`.
 */
export const updateProductSchema = v.object({
	name: v.optional(nameSchema),
	sku: v.optional(skuSchema),
	price: v.optional(priceSchema),
	description: v.optional(v.nullable(descriptionSchema)),
	photoUrl: v.optional(v.nullable(photoUrlSchema)),
	// Absent means "unchanged": the stored unit is kept.
	measureUnit: v.optional(measureUnitSchema),
	// Absent means "unchanged": the product keeps its category. An explicit
	// `null` clears it, and an id moves it to that category (S7).
	categoryId: v.optional(v.nullable(categoryIdSchema)),
});

/**
 * Request schema for the `search` query of `GET .../products`.
 *
 * The length cap is the contract's (`maxLength: 100`), and a blank value means
 * "no search": the client clearing the box must not hide the catalogue.
 *
 * `deleted` arrives as a string, so it is parsed like `limit` in the movement
 * query: only `"true"` and `"false"` are accepted, anything else (`1`, `yes`,
 * `maybe`) is a 400 instead of a silently false filter. The default is written
 * as the raw query string the schema receives, so an absent parameter keeps
 * listing the active catalogue.
 */
const deletedSchema = v.pipe(
	v.picklist(["true", "false"], `deleted must be "true" or "false"`),
	v.transform((value) => value === "true"),
);

export const listProductsQuerySchema = v.object({
	search: v.optional(
		v.pipe(
			v.string(),
			v.trim(),
			v.maxLength(100, "search must be at most 100 characters"),
		),
	),
	deleted: v.optional(deletedSchema, "false"),
});

/**
 * The status filter of `GET .../products/{productId}/units` (L23).
 *
 * It arrives as a string, so the closed list lives here: an unknown value is a
 * 400 with the issue list instead of a silently different read. The default is
 * the raw query string the schema receives, so an absent parameter answers the
 * stock a sale can still take.
 */
export const listProductUnitsQuerySchema = v.object({
	status: v.optional(
		v.picklist(
			["AVAILABLE", "SOLD", "ALL"],
			"status must be one of AVAILABLE, SOLD or ALL",
		),
		"AVAILABLE",
	),
});
