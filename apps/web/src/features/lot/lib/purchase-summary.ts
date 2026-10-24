/**
 * What the purchase block shows while the person types: how many units the lot
 * will have, the measured total and what the purchase costs.
 *
 * `measureTotal` and `total` are decimal **strings**, the shape the rest of the
 * UI formats, and they are computed from integers (thousandths of a measure and
 * cents) so no float ever decides a cent: `0.1 + 0.2` must not become the total
 * of a purchase.
 */
export type PurchaseSummary = {
	unitCount: number;
	/** Thousandths formatted as `Decimal(12,3)`, e.g. `"84.500"`. */
	measureTotal: string;
	/** Cents formatted as `Decimal(12,2)`, e.g. `"498100.00"`. */
	total: string;
};

/** The thousandths of a measure, from the number the box parsed. */
const THOUSANDTHS = 1000;

/** A money string the contract accepts: up to two decimals. */
const MONEY = /^(\d{1,10})(?:\.(\d{1,2}))?$/;

/**
 * Computes the live summary of a purchase, or `null` when it cannot be computed
 * yet (no units, or a price that is still being typed).
 *
 * The arithmetic is **informative only** (L21): the server derives the lot's
 * `measureTotal` and allocates each unit's cost, and the client never disagrees
 * with it — this is the number the person checks against the invoice before
 * submitting.
 */
export function summarizePurchase(
	measures: number[],
	costPerMeasure: string,
): PurchaseSummary | null {
	const money = MONEY.exec(costPerMeasure.trim());
	if (measures.length === 0 || !money) {
		return null;
	}

	const costCents =
		Number(money[1]) * 100 + Number((money[2] ?? "").padEnd(2, "0"));
	if (costCents <= 0) {
		return null;
	}

	const measureThousandths = measures.reduce(
		(total, measure) => total + Math.round(measure * THOUSANDTHS),
		0,
	);
	// Medida total × $/medida, in cents, rounded once at the end: the same
	// product the server does before it allocates the units (S3).
	const totalCents = Math.round((measureThousandths * costCents) / THOUSANDTHS);

	return {
		unitCount: measures.length,
		measureTotal: decimalFromThousandths(measureThousandths),
		total: decimalFromCents(totalCents),
	};
}

/** `84500` -> `"84.500"`, the `Decimal(12,3)` the contract sends. */
function decimalFromThousandths(thousandths: number): string {
	const whole = Math.floor(thousandths / THOUSANDTHS);
	const decimals = String(thousandths % THOUSANDTHS).padStart(3, "0");
	return `${whole}.${decimals}`;
}

/** `49810000` -> `"498100.00"`, the `Decimal(12,2)` the contract sends. */
function decimalFromCents(cents: number): string {
	const whole = Math.floor(cents / 100);
	const decimals = String(cents % 100).padStart(2, "0");
	return `${whole}.${decimals}`;
}

/**
 * Formats the measured total for display, in the es-AR convention the rest of
 * the UI uses: a dot groups thousands and a comma separates the decimals
 * (`"1234.500"` -> `"1.234,500"`).
 *
 * Deliberately locale-free, like `formatPrice`: `Intl.NumberFormat` follows the
 * runtime's ICU data and would render differently in Node and in the browser.
 */
export function formatMeasure(measure: string): string {
	const match = /^(\d+)\.(\d{1,3})$/.exec(measure.trim());
	if (!match) {
		return measure;
	}

	const whole = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ".");

	return `${whole},${match[2]}`;
}
