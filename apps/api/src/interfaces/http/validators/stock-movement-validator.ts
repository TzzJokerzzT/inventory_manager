import * as v from "valibot";
import { CustomerRequiresExitError } from "../../../domain/errors/customer-requires-exit-error.js";

/**
 * `quantity` is always positive: the direction of a movement lives in `type`,
 * never in the sign of the number. The range is the frozen one from the
 * OpenAPI contract.
 */
const quantitySchema = v.pipe(
	v.number(),
	v.integer("quantity must be an integer"),
	v.minValue(1, "quantity must be at least 1"),
	v.maxValue(1_000_000, "quantity must be at most 1000000"),
);

const reasonSchema = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(300, "reason must be at most 300 characters"),
);

const typeSchema = v.picklist(["IN", "OUT"], "type must be IN or OUT");

/**
 * The optional customer of a sale. An absent or `null` value is "no customer";
 * a present one must be a uuid, and the use case and the entity apply the same
 * trim/normalization before it is stored.
 */
const customerIdSchema = v.pipe(
	v.string(),
	v.uuid("customerId must be a uuid"),
);

/**
 * Request schema for `POST /companies/:companyId/movements`.
 *
 * Only the fields a client may send exist here: `userId` and `createdAt` are
 * server-owned (the actor comes from the token, the date from the server), so
 * valibot drops them from the parsed output instead of letting them reach the
 * use case.
 *
 * The `customerId`/`type` pairing is checked at the edge as well as in the use
 * case: a customer identifies the buyer of a sale (CLI-04), so an entry with
 * one is a 400 `customer_requires_exit` instead of a silently ignored field.
 */
export const createStockMovementSchema = v.pipe(
	v.object({
		productId: v.pipe(v.string(), v.uuid("productId must be a uuid")),
		type: typeSchema,
		quantity: quantitySchema,
		reason: v.optional(v.nullable(reasonSchema)),
		customerId: v.optional(v.nullable(customerIdSchema)),
	}),
	v.check((input) => {
		if (
			input.type !== "OUT" &&
			input.customerId !== null &&
			input.customerId !== undefined
		) {
			// Thrown instead of reported as an issue on purpose: a customer on an
			// entry is a domain rule (`customer_requires_exit`), not a malformed
			// field, and the contract answers that case with a coded 400. The
			// error handler owns the status mapping.
			throw new CustomerRequiresExitError();
		}

		return true;
	}),
);

/**
 * Query values arrive as strings, so `limit` is parsed and then validated as
 * the integer the contract asks for. A malformed value (`abc`, `1.5`, `0`,
 * `201`) fails here and answers 400 instead of reaching the query.
 */
const limitSchema = v.pipe(
	v.string(),
	v.transform((value) => Number(value)),
	v.number(),
	v.integer("limit must be an integer"),
	v.minValue(1, "limit must be between 1 and 200"),
	v.maxValue(200, "limit must be between 1 and 200"),
);

/**
 * Request schema for the `GET /companies/:companyId/movements` query.
 *
 * The default of `limit` is the contract's: an absent limit is the first page,
 * not "everything". It is written `"50"` and not `50` because valibot applies
 * a default to the *input* of the schema, which is the raw query string; the
 * parsed output is the integer.
 */
export const listStockMovementsQuerySchema = v.object({
	productId: v.optional(v.pipe(v.string(), v.uuid("productId must be a uuid"))),
	type: v.optional(typeSchema),
	limit: v.optional(limitSchema, "50"),
});
