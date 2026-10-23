import { check, pipe, safeParse, string } from "valibot";

/**
 * The limits the API applies to a customer, mirrored here so the form never
 * sends something the server would reject.
 */
export const MAX_CUSTOMER_NAME_LENGTH = 120;
export const MAX_CUSTOMER_EMAIL_LENGTH = 254;
export const MAX_CUSTOMER_PHONE_LENGTH = 40;
export const MAX_CUSTOMER_ADDRESS_LENGTH = 300;

/**
 * The body's phone rule, character for character: digits and `+ - ( ) .` and
 * spaces, nothing else. It is applied to the trimmed value, so a stray space
 * around a real number is not part of it.
 */
export const CUSTOMER_PHONE_PATTERN = /^[0-9+\-().\s]*$/;

/**
 * A deliberately small email shape: something, an `@`, something, a dot and a
 * domain. The API is the authority on what it accepts; this only keeps an
 * obvious mistake from becoming a round-trip.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What the form holds while the person is typing. */
export type CustomerFormValues = {
	name: string;
	email: string;
	phone: string;
	address: string;
};

/** One message per invalid field; an absent key means the field is valid. */
export type CustomerFormErrors = Partial<
	Record<keyof CustomerFormValues, string>
>;

/**
 * The messages are part of the contract: the form renders them as-is, so they
 * stay in the UI language of the rest of the app.
 */
const NAME_REQUIRED = "Ingresá el nombre del cliente.";
const NAME_TOO_LONG = `Usá ${MAX_CUSTOMER_NAME_LENGTH} caracteres como máximo en el nombre.`;
const EMAIL_TOO_LONG = `Usá ${MAX_CUSTOMER_EMAIL_LENGTH} caracteres como máximo en el email.`;
const EMAIL_INVALID =
	"Ingresá un email válido, por ejemplo cliente@empresa.com.";
const PHONE_TOO_LONG = `Usá ${MAX_CUSTOMER_PHONE_LENGTH} caracteres como máximo en el teléfono.`;
const PHONE_INVALID = "Usá sólo números y los signos + - ( ) . en el teléfono.";
const ADDRESS_TOO_LONG = `Usá ${MAX_CUSTOMER_ADDRESS_LENGTH} caracteres como máximo en la dirección.`;

/**
 * Emptiness and length are measured on the trimmed value, exactly like the
 * server. `pipe` stops at the first failing check, so a blank name reports the
 * required message instead of the length one.
 */
const nameSchema = pipe(
	string(),
	check((value) => value.trim() !== "", NAME_REQUIRED),
	check(
		(value) => value.trim().length <= MAX_CUSTOMER_NAME_LENGTH,
		NAME_TOO_LONG,
	),
);

/**
 * The email is optional: a blank value stops the checks early, because the API
 * stores it as `null`. A present one must fit the column and look like an
 * address.
 */
const emailSchema = pipe(
	string(),
	check(
		(value) => value.trim().length <= MAX_CUSTOMER_EMAIL_LENGTH,
		EMAIL_TOO_LONG,
	),
	check(
		(value) => value.trim() === "" || EMAIL_PATTERN.test(value.trim()),
		EMAIL_INVALID,
	),
);

const phoneSchema = pipe(
	string(),
	check(
		(value) => value.trim().length <= MAX_CUSTOMER_PHONE_LENGTH,
		PHONE_TOO_LONG,
	),
	check((value) => CUSTOMER_PHONE_PATTERN.test(value.trim()), PHONE_INVALID),
);

const addressSchema = pipe(
	string(),
	check(
		(value) => value.trim().length <= MAX_CUSTOMER_ADDRESS_LENGTH,
		ADDRESS_TOO_LONG,
	),
);

/**
 * Validates every field and returns the messages to show.
 *
 * It reports all invalid fields at once, not just the first one: a person
 * correcting a form should not discover the next error after each submit.
 */
export function validateCustomer(
	values: CustomerFormValues,
): CustomerFormErrors {
	const errors: CustomerFormErrors = {};

	const name = safeParse(nameSchema, values.name);
	if (!name.success) {
		errors.name = name.issues[0]?.message;
	}

	const email = safeParse(emailSchema, values.email);
	if (!email.success) {
		errors.email = email.issues[0]?.message;
	}

	const phone = safeParse(phoneSchema, values.phone);
	if (!phone.success) {
		errors.phone = phone.issues[0]?.message;
	}

	const address = safeParse(addressSchema, values.address);
	if (!address.success) {
		errors.address = address.issues[0]?.message;
	}

	return errors;
}

/** Trimmed, like the server stores the name. */
export function normalizeCustomerName(name: string): string {
	return name.trim();
}

/**
 * Trimmed and lowercased, or `null` for a blank value.
 *
 * The API lowercases the email so search and comparison are canonical; doing it
 * here too means the value the person sees after the write is the value that
 * was stored.
 */
export function normalizeCustomerEmail(email: string): string | null {
	return toNullableContact(email.toLowerCase());
}

/**
 * A blank contact field is sent as `null`, which is how the API clears it: an
 * empty string would be a value, not an absence.
 */
export function toNullableContact(value: string): string | null {
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}
