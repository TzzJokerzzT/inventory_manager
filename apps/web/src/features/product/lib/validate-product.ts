import { check, pipe, safeParse, string } from "valibot";
import {
	ALLOWED_PHOTO_FORMATS,
	formatMegabytes,
	MAX_PHOTO_BYTES,
	matchesAllowedFormat,
} from "./product-photo";

/**
 * The limits the API applies to a product, mirrored here so the form never
 * sends something the server would reject.
 */
export const MAX_PRODUCT_NAME_LENGTH = 120;
export const MAX_PRODUCT_SKU_LENGTH = 64;
export const MAX_PRODUCT_DESCRIPTION_LENGTH = 1000;

/** The body's price rule, character for character. */
export const PRODUCT_PRICE_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/** What the form holds while the person is typing. */
export type ProductFormValues = {
	name: string;
	sku: string;
	price: string;
	description: string;
};

/** One message per invalid field; an absent key means the field is valid. */
export type ProductFormErrors = Partial<
	Record<keyof ProductFormValues, string>
>;

/**
 * The messages are part of the contract: the form renders them as-is, so they
 * stay in the UI language of the rest of the app.
 */
const NAME_REQUIRED = "Ingresá el nombre del producto.";
const NAME_TOO_LONG = `Usá ${MAX_PRODUCT_NAME_LENGTH} caracteres como máximo en el nombre.`;
const SKU_REQUIRED = "Ingresá el código SKU.";
const SKU_TOO_LONG = `Usá ${MAX_PRODUCT_SKU_LENGTH} caracteres como máximo en el SKU.`;
const PRICE_REQUIRED = "Ingresá el precio unitario.";
const PRICE_INVALID =
	"Usá un número con hasta dos decimales, por ejemplo 1500.00.";
const DESCRIPTION_TOO_LONG = `Usá ${MAX_PRODUCT_DESCRIPTION_LENGTH} caracteres como máximo en la descripción.`;
const PHOTO_TOO_LARGE = `La foto no puede superar los ${formatMegabytes(MAX_PHOTO_BYTES)}.`;
const PHOTO_FORMAT = "La foto debe ser JPG, PNG o WebP.";

/**
 * Emptiness and length are measured on the trimmed value, exactly like the
 * server: whitespace around a real name is not part of it. `pipe` stops at the
 * first failing check, so an empty value reports the required message instead
 * of the length one.
 */
const nameSchema = pipe(
	string(),
	check((value) => value.trim() !== "", NAME_REQUIRED),
	check(
		(value) => value.trim().length <= MAX_PRODUCT_NAME_LENGTH,
		NAME_TOO_LONG,
	),
);

const skuSchema = pipe(
	string(),
	check((value) => value.trim() !== "", SKU_REQUIRED),
	check((value) => value.trim().length <= MAX_PRODUCT_SKU_LENGTH, SKU_TOO_LONG),
);

/**
 * The price stays a string end to end. The pattern rejects a comma, a negative
 * amount and more than two decimals, which is exactly the body rule; the
 * message names an example so the correction is obvious.
 */
const priceSchema = pipe(
	string(),
	check((value) => value.trim() !== "", PRICE_REQUIRED),
	check((value) => PRODUCT_PRICE_PATTERN.test(value.trim()), PRICE_INVALID),
);

const descriptionSchema = pipe(
	string(),
	check(
		(value) => value.trim().length <= MAX_PRODUCT_DESCRIPTION_LENGTH,
		DESCRIPTION_TOO_LONG,
	),
);

/**
 * Validates every field and returns the messages to show.
 *
 * It reports all invalid fields at once, not just the first one: a person
 * correcting a form should not discover the next error after each submit.
 */
export function validateProduct(values: ProductFormValues): ProductFormErrors {
	const errors: ProductFormErrors = {};

	const name = safeParse(nameSchema, values.name);
	if (!name.success) {
		errors.name = name.issues[0]?.message;
	}

	const sku = safeParse(skuSchema, values.sku);
	if (!sku.success) {
		errors.sku = sku.issues[0]?.message;
	}

	const price = safeParse(priceSchema, values.price);
	if (!price.success) {
		errors.price = price.issues[0]?.message;
	}

	const description = safeParse(descriptionSchema, values.description);
	if (!description.success) {
		errors.description = description.issues[0]?.message;
	}

	return errors;
}

/**
 * Validates the chosen photo before it is uploaded, so a wrong format or an
 * oversized file gets a readable message instead of a rejected request.
 */
export function validateProductPhoto(file: File): string | null {
	if (!matchesAllowedFormat(file, ALLOWED_PHOTO_FORMATS)) {
		return PHOTO_FORMAT;
	}
	if (file.size > MAX_PHOTO_BYTES) {
		return PHOTO_TOO_LARGE;
	}
	return null;
}

/**
 * Completes the amount to the two decimals the column stores (`1500` →
 * `1500.00`), without ever going through a float.
 */
export function normalizePrice(price: string): string {
	const [whole, decimals = ""] = price.trim().split(".");
	return `${whole}.${decimals.padEnd(2, "0").slice(0, 2)}`;
}

/** Trimmed and uppercased, like the server normalizes the SKU. */
export function normalizeSku(sku: string): string {
	return sku.trim().toUpperCase();
}

/** A blank description is sent as `null`, which is how the API clears it. */
export function toNullableDescription(description: string): string | null {
	const trimmed = description.trim();
	return trimmed === "" ? null : trimmed;
}
