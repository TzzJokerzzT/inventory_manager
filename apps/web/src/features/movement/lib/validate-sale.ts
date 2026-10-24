import { check, pipe, safeParse, string } from "valibot";

/**
 * The decimals the API stores for `unitPrice` (`Decimal(12,2)`): the price
 * written on a sale is money, and the column never carries more precision.
 */
export const MAX_UNIT_PRICE_DECIMALS = 2;

/** What the sale asks for while the person is choosing (L25). */
export type SaleFormValues = {
	/** The units taken, one per unit of `quantity` (S2). */
	unitIds: string[];
	/** The price written on the sale, which is the real one (S1). */
	unitPrice: string;
};

/** One message per invalid field; an absent key means the field is valid. */
export type SaleFormErrors = Partial<Record<keyof SaleFormValues, string>>;

const UNITS_REQUIRED = "Elegí al menos una unidad para la venta.";
const UNIT_PRICE_REQUIRED = "Ingresá el precio de venta.";
const UNIT_PRICE_INVALID = `Usá un precio mayor que cero, con hasta ${MAX_UNIT_PRICE_DECIMALS} decimales.`;

/**
 * The price travels as a decimal string, exactly like the product's: the server
 * rejects a float, so the form never builds one. Two decimals are the most the
 * column stores; a third would be silently rounded somewhere else.
 */
const UNIT_PRICE_TOKEN = /^\d{1,10}(\.\d{1,2})?$/;

const unitPriceSchema = pipe(
	string(),
	check((value) => value.trim() !== "", UNIT_PRICE_REQUIRED),
	check(
		(value) => UNIT_PRICE_TOKEN.test(value.trim()) && Number(value.trim()) > 0,
		UNIT_PRICE_INVALID,
	),
);

/**
 * Validates what a sale of a product **with units** needs, field by field, and
 * reports every invalid one at once.
 *
 * It mirrors the server's rule instead of replacing it (L9/L10): the sale sends
 * one id per unit of `quantity` plus the written price, and the API answers
 * `400 units_required` when either is missing. The messages are part of the
 * contract with the screen, so they stay in the UI language of the rest of the
 * app and match the ones the API failures are mapped to.
 */
export function validateSale(values: SaleFormValues): SaleFormErrors {
	const errors: SaleFormErrors = {};

	if (values.unitIds.length === 0) {
		errors.unitIds = UNITS_REQUIRED;
	}

	const unitPrice = safeParse(unitPriceSchema, values.unitPrice);
	if (!unitPrice.success) {
		errors.unitPrice = unitPrice.issues[0]?.message;
	}

	return errors;
}

/** The price as the API expects it: trimmed, still a decimal string. */
export function normalizeUnitPrice(unitPrice: string): string {
	return unitPrice.trim();
}
