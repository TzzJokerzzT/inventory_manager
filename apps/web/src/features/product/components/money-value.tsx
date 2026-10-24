import { formatPrice } from "../lib/format-price";

export type MoneyValueProps = {
	/** The contract's decimal string, or `null` when the amount is unknown. */
	value: string | null;
	/**
	 * What is said, in words, when the amount is unknown: it is the sentence a
	 * screen reader announces in place of the dash, and it names *which* number
	 * is missing.
	 */
	unknownLabel: string;
};

/**
 * One money cell of a table: the contract's decimal string through
 * {@link formatPrice}, or the em dash when the value is unknown (L11, L26).
 *
 * The dash is **decorative** (`aria-hidden`), so what is announced is the reason
 * beside it instead of a punctuation mark read aloud. A `null` never becomes
 * `0`: a zero is a claim that nobody paid a cost, and an unknown cost is a
 * different fact — the product has no available units, or the sale predates the
 * written price (S9).
 *
 * The value is never parsed as a float here: a negative margin keeps its sign
 * because `formatPrice` puts it in front of the amount.
 */
export function MoneyValue({ value, unknownLabel }: MoneyValueProps) {
	if (value === null) {
		return (
			<span className="whitespace-nowrap">
				<span aria-hidden="true">—</span>
				<span className="sr-only">{unknownLabel}</span>
			</span>
		);
	}

	return <span className="whitespace-nowrap">{formatPrice(value)}</span>;
}
