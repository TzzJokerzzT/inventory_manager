import { check, pipe, safeParse, string } from "valibot";

/**
 * The name cap the API applies to a category, mirrored here so the form never
 * sends something the server would reject.
 *
 * It is the same 120 as the product, customer and supplier name, measured after
 * the trim the API applies. Uniqueness is **case-sensitive** on purpose — the
 * `@@unique([companyId, name])` index is — and it is the server that owns it:
 * this module validates the shape of one field, never the catalogue it belongs
 * to.
 */
export const MAX_CATEGORY_NAME_LENGTH = 120;

/** What the form holds while the person is typing. */
export type CategoryFormValues = {
	name: string;
};

/** One message per invalid field; an absent key means the field is valid. */
export type CategoryFormErrors = Partial<
	Record<keyof CategoryFormValues, string>
>;

/**
 * The messages are part of the contract: the form renders them as-is, so they
 * stay in the UI language of the rest of the app.
 */
const NAME_REQUIRED = "Ingresá el nombre de la categoría.";
const NAME_TOO_LONG = `Usá ${MAX_CATEGORY_NAME_LENGTH} caracteres como máximo en el nombre de la categoría.`;

/**
 * Emptiness and length are measured on the trimmed value, exactly like the
 * server. `pipe` stops at the first failing check, so a blank name reports the
 * required message instead of the length one.
 */
const nameSchema = pipe(
	string(),
	check((value) => value.trim() !== "", NAME_REQUIRED),
	check(
		(value) => value.trim().length <= MAX_CATEGORY_NAME_LENGTH,
		NAME_TOO_LONG,
	),
);

/**
 * Validates every field and returns the messages to show.
 *
 * It reports all invalid fields at once, not just the first one: a person
 * correcting a form should not discover the next error after each submit.
 */
export function validateCategory(
	values: CategoryFormValues,
): CategoryFormErrors {
	const errors: CategoryFormErrors = {};

	const name = safeParse(nameSchema, values.name);
	if (!name.success) {
		errors.name = name.issues[0]?.message;
	}

	return errors;
}

/**
 * Trimmed, like the server stores the name.
 *
 * The name is **not** case-folded on purpose: it is display text read back by a
 * human, so the uniqueness the API enforces is case-sensitive and `Bebidas`
 * survives as typed.
 */
export function normalizeCategoryName(name: string): string {
	return name.trim();
}
