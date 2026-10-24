import * as v from "valibot";

/**
 * The name cap is the same 120 as the product and the customer name, and it is
 * deliberately the validator (not the entity) that answers a too-long value:
 * the contract says `400` with an issue list, while a domain rejection would be
 * a `422`.
 */
const nameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "name must not be empty"),
	v.maxLength(120, "name must be at most 120 characters"),
);

/**
 * The contact is free text (a person, a phone, an email or all three). The
 * empty string is valid here because the domain normalizes it to `null`, the
 * same as an absent field: clearing the box and never sending the field are one
 * state.
 */
const contactSchema = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(120, "contact must be at most 120 characters"),
);

/**
 * Request schema for `POST /companies/:companyId/suppliers`.
 *
 * Only the writable fields exist here, so an unknown body key is dropped by
 * valibot instead of reaching the use case. The company never comes from the
 * body: it comes from the resolved company context.
 */
export const createSupplierSchema = v.object({
	name: nameSchema,
	contact: v.optional(v.nullable(contactSchema)),
});

/**
 * Request schema for `PATCH /companies/:companyId/suppliers/:supplierId`.
 *
 * Every field is optional and its absence means "unchanged", while an explicit
 * `null` clears `contact` -- that is why the field is `optional(nullable(...))`
 * and not `optional(..., null)`.
 */
export const updateSupplierSchema = v.object({
	name: v.optional(nameSchema),
	contact: v.optional(v.nullable(contactSchema)),
});
