import * as v from "valibot";

/**
 * The name cap is the same 120 as the product, customer and supplier name, and
 * it is deliberately the validator (not the entity) that answers a too-long
 * value: the contract says `400` with an issue list, while a domain rejection
 * would be a `422`.
 */
const nameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "name must not be empty"),
	v.maxLength(120, "name must be at most 120 characters"),
);

/**
 * Request schema for `POST /companies/:companyId/categories`.
 *
 * Only the writable fields exist here, so an unknown body key is dropped by
 * valibot instead of reaching the use case. The company never comes from the
 * body: it comes from the resolved company context.
 */
export const createCategorySchema = v.object({
	name: nameSchema,
});

/**
 * Request schema for `PATCH /companies/:companyId/categories/:categoryId`.
 *
 * The name is optional and its absence means "unchanged"; there is no other
 * writable field, because the identity and the company are not.
 */
export const updateCategorySchema = v.object({
	name: v.optional(nameSchema),
});
