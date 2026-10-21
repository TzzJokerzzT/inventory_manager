import { check, pipe, safeParse, string } from "valibot";

/**
 * The limits the API applies to a movement, mirrored here so the form never
 * sends something the server would reject.
 */
export const MAX_MOVEMENT_REASON_LENGTH = 300;
export const MAX_MOVEMENT_QUANTITY = 1_000_000;

/** What the form holds while the person is typing. */
export type MovementFormValues = {
	productId: string;
	quantity: string;
	reason: string;
};

/** One message per invalid field; an absent key means the field is valid. */
export type MovementFormErrors = Partial<
	Record<keyof MovementFormValues, string>
>;

/**
 * The messages are part of the contract: the form renders them as-is, so they
 * stay in the UI language of the rest of the app.
 */
const PRODUCT_REQUIRED = "Seleccioná un producto.";
const QUANTITY_REQUIRED = "Ingresá la cantidad.";
const QUANTITY_NOT_INTEGER = "Usá una cantidad entera, por ejemplo 10.";
const QUANTITY_OUT_OF_RANGE = "Usá una cantidad entre 1 y 1.000.000.";
const REASON_TOO_LONG = `Usá ${MAX_MOVEMENT_REASON_LENGTH} caracteres como máximo en el motivo.`;

const productSchema = pipe(
	string(),
	check((value) => value.trim() !== "", PRODUCT_REQUIRED),
);

/**
 * The quantity stays a string while the person types; the rule is the body's:
 * a positive integer between 1 and 1.000.000. The direction lives in `type`,
 * never in the sign, so `-3` is rejected as a range error instead of being
 * silently accepted as an exit.
 */
const quantitySchema = pipe(
	string(),
	check((value) => value.trim() !== "", QUANTITY_REQUIRED),
	check((value) => /^-?\d+$/.test(value.trim()), QUANTITY_NOT_INTEGER),
	check((value) => {
		const quantity = Number(value.trim());
		return quantity >= 1 && quantity <= MAX_MOVEMENT_QUANTITY;
	}, QUANTITY_OUT_OF_RANGE),
);

const reasonSchema = pipe(
	string(),
	check(
		(value) => value.trim().length <= MAX_MOVEMENT_REASON_LENGTH,
		REASON_TOO_LONG,
	),
);

/**
 * Validates every field and returns the messages to show.
 *
 * It reports all invalid fields at once, not just the first one: a person
 * correcting a form should not discover the next error after each submit.
 */
export function validateMovement(
	values: MovementFormValues,
): MovementFormErrors {
	const errors: MovementFormErrors = {};

	const product = safeParse(productSchema, values.productId);
	if (!product.success) {
		errors.productId = product.issues[0]?.message;
	}

	const quantity = safeParse(quantitySchema, values.quantity);
	if (!quantity.success) {
		errors.quantity = quantity.issues[0]?.message;
	}

	const reason = safeParse(reasonSchema, values.reason);
	if (!reason.success) {
		errors.reason = reason.issues[0]?.message;
	}

	return errors;
}

/** A blank reason is sent as `null`, which is how the API stores "no reason". */
export function normalizeReason(reason: string): string | null {
	const trimmed = reason.trim();
	return trimmed === "" ? null : trimmed;
}
