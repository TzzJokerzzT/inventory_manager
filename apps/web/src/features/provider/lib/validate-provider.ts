import { check, pipe, safeParse, string } from "valibot";

/**
 * The limits the API applies to a supplier, mirrored here so the form never
 * sends something the server would reject.
 *
 * The name cap is the same 120 as the product and the customer name; the
 * contact is free text (a person, a phone, an email or all three) with the same
 * cap, which is the one the HTTP validator enforces.
 */
export const MAX_SUPPLIER_NAME_LENGTH = 120;
export const MAX_SUPPLIER_CONTACT_LENGTH = 120;

/** What the form holds while the person is typing. */
export type ProviderFormValues = {
	name: string;
	contact: string;
};

/** One message per invalid field; an absent key means the field is valid. */
export type ProviderFormErrors = Partial<
	Record<keyof ProviderFormValues, string>
>;

/**
 * The messages are part of the contract: the form renders them as-is, so they
 * stay in the UI language of the rest of the app.
 */
const NAME_REQUIRED = "Ingresá el nombre del proveedor.";
const NAME_TOO_LONG = `Usá ${MAX_SUPPLIER_NAME_LENGTH} caracteres como máximo en el nombre del proveedor.`;
const CONTACT_TOO_LONG = `Usá ${MAX_SUPPLIER_CONTACT_LENGTH} caracteres como máximo en el contacto.`;

/**
 * Emptiness and length are measured on the trimmed value, exactly like the
 * server. `pipe` stops at the first failing check, so a blank name reports the
 * required message instead of the length one.
 */
const nameSchema = pipe(
	string(),
	check((value) => value.trim() !== "", NAME_REQUIRED),
	check(
		(value) => value.trim().length <= MAX_SUPPLIER_NAME_LENGTH,
		NAME_TOO_LONG,
	),
);

/**
 * The contact is optional: a blank value stops the checks early, because the API
 * stores it as `null`.
 */
const contactSchema = pipe(
	string(),
	check(
		(value) => value.trim().length <= MAX_SUPPLIER_CONTACT_LENGTH,
		CONTACT_TOO_LONG,
	),
);

/**
 * Validates every field and returns the messages to show.
 *
 * It reports all invalid fields at once, not just the first one: a person
 * correcting a form should not discover the next error after each submit.
 */
export function validateProvider(
	values: ProviderFormValues,
): ProviderFormErrors {
	const errors: ProviderFormErrors = {};

	const name = safeParse(nameSchema, values.name);
	if (!name.success) {
		errors.name = name.issues[0]?.message;
	}

	const contact = safeParse(contactSchema, values.contact);
	if (!contact.success) {
		errors.contact = contact.issues[0]?.message;
	}

	return errors;
}

/**
 * Trimmed, like the server stores the name.
 *
 * The name is **not** case-folded on purpose: it is display text read back by a
 * human, so the uniqueness the API enforces is case-sensitive and
 * `Distribuidora Sur` survives as typed.
 */
export function normalizeProviderName(name: string): string {
	return name.trim();
}

/**
 * A blank contact is sent as `null`, which is how the API clears it: an empty
 * string would be a value, not an absence.
 */
export function toNullableProviderContact(contact: string): string | null {
	const trimmed = contact.trim();
	return trimmed === "" ? null : trimmed;
}
