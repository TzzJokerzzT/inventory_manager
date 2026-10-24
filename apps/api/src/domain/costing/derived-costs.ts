import {
	formatMeasure,
	formatMoney,
	MEASURE_SCALE,
	MONEY_SCALE,
	moneyFromText,
} from "../entities/lot-unit.js";
import { DomainError } from "../errors/domain-error.js";

/**
 * The cost of a product's `AVAILABLE` units, as the store sums it (L12).
 *
 * Both totals travel as decimal strings of the columns they come from
 * (`measure` is `Decimal(12,3)`, `cost` is `Decimal(12,2)`), but a **sum** may
 * exceed the width of a single column: 500 rolls of the largest roll are more
 * than `Decimal(12,3)` can hold. The readers below therefore parse arbitrarily
 * long decimal strings instead of reusing the column-sized parsers.
 */
export interface AvailableUnitTotals {
	/** How many units are still `AVAILABLE`. */
	unitCount: number;
	/** Σ `measure` of those units, a decimal string with up to three decimals. */
	measureTotal: string;
	/** Σ `cost` of those units, a decimal string with up to two decimals. */
	costTotal: string;
}

/**
 * The derived cost figures of a product (L12). None of them is stored, so none
 * of them can desynchronize from the units they summarize.
 *
 * `costPerMeasure`, `unitCost` and `marginPerUnit` are `null` -- never `0` --
 * while the product has no available unit: "no cost yet" and "a free unit" are
 * different facts. `availableUnits` and `availableMeasure` are real zeros in
 * that case, because they are counts and sums of nothing, not unknown money.
 */
export interface ProductCosts {
	availableUnits: number;
	/** Σ `measure` of the available units, always three decimals. */
	availableMeasure: string;
	/** Σ cost / Σ measure, always two decimals, or `null` with no units. */
	costPerMeasure: string | null;
	/** Σ cost / count, always two decimals, or `null` with no units. */
	unitCost: string | null;
	/** The listed price minus `unitCost`, or `null` with no `unitCost`. */
	marginPerUnit: string | null;
}

/** A decimal string of any width: a sum is not bounded by a column. */
const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/**
 * Reads a non-negative decimal string into its scaled integer, or throws when
 * it is not one.
 *
 * A value with more precision than the scale is a store inconsistency, not
 * something to round: the columns this comes from never carry more decimals
 * than their scale, and silently dropping digits here would change the money.
 */
function scaledFromText(
	raw: string,
	decimals: number,
	scale: bigint,
	label: string,
): bigint {
	const match = DECIMAL_PATTERN.exec(raw.trim());

	if (match === null || (match[2] ?? "").length > decimals) {
		throw new DomainError(`Unreadable ${label}: ${raw}`);
	}

	return (
		BigInt(match[1]) * scale + BigInt((match[2] ?? "").padEnd(decimals, "0"))
	);
}

/**
 * Divides two non-negative integers rounding half up.
 *
 * `(2a + b) / 2b` is exact half up without ever going through a float, which is
 * what "rounded to two decimals" means here: `2.5` cents becomes `3` and
 * `2.4999` stays `2`, on every machine.
 */
function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
	if (denominator <= 0n) {
		throw new Error("A derived cost cannot divide by a non-positive amount");
	}

	return (2n * numerator + denominator) / (2n * denominator);
}

/**
 * Writes an amount in cents, keeping a negative sign.
 *
 * `formatMoney` splits a BigInt with `/` and `%`, which both truncate toward
 * zero, so a loss has to be formatted from its absolute value and signed here
 * instead of being passed through as a negative.
 */
function formatSignedMoney(cents: bigint): string {
	return cents < 0n ? `-${formatMoney(-cents)}` : formatMoney(cents);
}

/**
 * The margin of one movement (L11): the income of the whole sale minus the cost
 * of the units it took.
 *
 * `unitPrice` is the price of **one** unit, so the income is
 * `unitPrice × quantity`; the cost is the sum of the units' own costs (S3).
 * Both sides are integers of cents, so the subtraction is exact and needs no
 * rounding -- the only place a decimal appears is the final formatting.
 *
 * It answers `null` -- never `0` -- when the price was not written (a movement
 * older than the field, S9) or when the movement has no units (an entry, or a
 * sale of a product that never came in a lot): "no cost" is not "zero cost".
 */
export function deriveMovementMargin(
	unitPrice: string | null,
	quantity: number,
	unitCosts: readonly string[],
): string | null {
	if (unitPrice === null || unitCosts.length === 0) {
		return null;
	}

	const priceCents = moneyFromText(unitPrice);
	if (priceCents === null) {
		throw new DomainError(`Unreadable stock movement unit price: ${unitPrice}`);
	}

	const costCents = unitCosts.reduce((total, raw) => {
		const cents = moneyFromText(raw);

		if (cents === null) {
			throw new DomainError(`Unreadable lot unit cost: ${raw}`);
		}

		return total + cents;
	}, 0n);

	return formatSignedMoney(priceCents * BigInt(quantity) - costCents);
}

/**
 * The derived cost figures of a product (L12), computed from its `AVAILABLE`
 * units only: a sold roll no longer costs the company anything it can sell.
 *
 * The divisions round half up to cents, and the result is returned as decimal
 * strings -- money never leaves the server as a float.
 */
export function deriveProductCosts(
	price: string,
	totals: AvailableUnitTotals | null | undefined,
): ProductCosts {
	if (totals === null || totals === undefined || totals.unitCount === 0) {
		return {
			availableUnits: 0,
			availableMeasure: formatMeasure(0n),
			costPerMeasure: null,
			unitCost: null,
			marginPerUnit: null,
		};
	}

	const measureMilli = scaledFromText(
		totals.measureTotal,
		MEASURE_SCALE.toString().length - 1,
		MEASURE_SCALE,
		"product available measure",
	);
	const costCents = scaledFromText(
		totals.costTotal,
		MONEY_SCALE.toString().length - 1,
		MONEY_SCALE,
		"product available cost",
	);

	// `measure × costPerMeasure` is `(milli / 1000) × (cents / 100)`, so the
	// cents of one measure are `cents × 1000 / milli`.
	const costPerMeasureCents = divideRoundHalfUp(
		costCents * MEASURE_SCALE,
		measureMilli,
	);
	const unitCostCents = divideRoundHalfUp(costCents, BigInt(totals.unitCount));

	const priceCents = moneyFromText(price);
	if (priceCents === null) {
		throw new DomainError(`Unreadable product price: ${price}`);
	}

	return {
		availableUnits: totals.unitCount,
		availableMeasure: formatMeasure(measureMilli),
		costPerMeasure: formatMoney(costPerMeasureCents),
		unitCost: formatMoney(unitCostCents),
		marginPerUnit: formatSignedMoney(priceCents - unitCostCents),
	};
}
