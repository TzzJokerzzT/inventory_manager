import * as v from "valibot";

/**
 * Shape check for the email, the same one the entity enforces. It lives here
 * too so a client mistake is a 400 with an issue list instead of a 422 from the
 * domain; the entity stays the authority for anything that reaches it by
 * another path.
 */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Digits plus the punctuation a phone number is typed with. */
const PHONE_PATTERN = /^[0-9+\-(). ]+$/;

const nameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "name must not be empty"),
	v.maxLength(120, "name must be at most 120 characters"),
);

/**
 * The empty string is valid here because the domain normalizes it to `null`,
 * the same as an absent field: clearing the box and never sending the field
 * are one state (S7).
 */
const emailSchema = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(254, "email must be at most 254 characters"),
	v.check(
		(value) => value.length === 0 || EMAIL_PATTERN.test(value),
		"email must be a valid email",
	),
);

const phoneSchema = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(40, "phone must be at most 40 characters"),
	v.check(
		(value) => value.length === 0 || PHONE_PATTERN.test(value),
		"phone must contain only digits and + - ( ) . and spaces",
	),
);

const addressSchema = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(300, "address must be at most 300 characters"),
);

/**
 * Request schema for `POST /companies/:companyId/customers`.
 *
 * Only the creatable fields exist here, so an unknown body key is dropped by
 * valibot instead of reaching the use case. The company never comes from the
 * body: it comes from the resolved company context.
 */
export const createCustomerSchema = v.object({
	name: nameSchema,
	email: v.optional(v.nullable(emailSchema)),
	phone: v.optional(v.nullable(phoneSchema)),
	address: v.optional(v.nullable(addressSchema)),
});

/**
 * Request schema for `PATCH /companies/:companyId/customers/:customerId`.
 *
 * Every field is optional and its absence means "unchanged", while an explicit
 * `null` clears `email`, `phone` or `address` -- that is why the fields are
 * `optional(nullable(...))` and not `optional(..., null)`.
 */
export const updateCustomerSchema = v.object({
	name: v.optional(nameSchema),
	email: v.optional(v.nullable(emailSchema)),
	phone: v.optional(v.nullable(phoneSchema)),
	address: v.optional(v.nullable(addressSchema)),
});

/**
 * Request schema for the `search` query of `GET .../customers`.
 *
 * The length cap is the contract's (`maxLength: 100`), and a blank value means
 * "no search": the client clearing the box must not hide the roster.
 */
export const listCustomersQuerySchema = v.object({
	search: v.optional(
		v.pipe(
			v.string(),
			v.trim(),
			v.maxLength(100, "search must be at most 100 characters"),
		),
	),
});
