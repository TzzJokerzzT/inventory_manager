import { check, pipe, safeParse, string } from "valibot";
import { parseMeasures } from "./parse-measures";

/**
 * The decimals the API stores for `costPerMeasure` (`Decimal(12,2)`): the money
 * of a purchase is never carried with more precision than that.
 */
export const MAX_COST_PER_MEASURE_DECIMALS = 2;

/** What the purchase block holds while the person is typing. */
export type PurchaseFormValues = {
	supplierId: string;
	costPerMeasure: string;
	/** The raw content of the measure box, parsed by {@link parseMeasures}. */
	measures: string;
};

/** One message per invalid field; an absent key means the field is valid. */
export type PurchaseFormErrors = Partial<
	Record<keyof PurchaseFormValues, string>
>;

const SUPPLIER_REQUIRED = "Seleccioná un proveedor.";
const COST_REQUIRED = "Ingresá el $ por medida.";
const COST_INVALID = `Usá un precio mayor que cero, con hasta ${MAX_COST_PER_MEASURE_DECIMALS} decimales.`;

/**
 * The price travels as a decimal string, exactly like the product's price: the
 * server rejects a float, so the form never builds one. Two decimals are the
 * most the column stores; a third would be silently rounded somewhere else.
 */
const COST_TOKEN = /^\d{1,10}(\.\d{1,2})?$/;

const supplierSchema = pipe(
	string(),
	check((value) => value.trim() !== "", SUPPLIER_REQUIRED),
);

const costSchema = pipe(
	string(),
	check((value) => value.trim() !== "", COST_REQUIRED),
	check(
		(value) => COST_TOKEN.test(value.trim()) && Number(value.trim()) > 0,
		COST_INVALID,
	),
);

/**
 * Validates the purchase block, field by field, and reports every invalid one at
 * once: a person correcting a form should not discover the next error after each
 * submit.
 *
 * The measure list delegates to {@link parseMeasures}, so the message the box
 * shows while typing is byte-for-byte the one the submit reports — one rule, one
 * copy.
 */
export function validatePurchase(
	values: PurchaseFormValues,
): PurchaseFormErrors {
	const errors: PurchaseFormErrors = {};

	const supplier = safeParse(supplierSchema, values.supplierId);
	if (!supplier.success) {
		errors.supplierId = supplier.issues[0]?.message;
	}

	const cost = safeParse(costSchema, values.costPerMeasure);
	if (!cost.success) {
		errors.costPerMeasure = cost.issues[0]?.message;
	}

	const measures = parseMeasures(values.measures);
	if (!measures.ok) {
		errors.measures = measures.message;
	}

	return errors;
}

/** The cost as the API expects it: trimmed, still a decimal string. */
export function normalizeCostPerMeasure(cost: string): string {
	return cost.trim();
}
