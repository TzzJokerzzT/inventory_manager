import type { Product } from "@/lib/api/schemas";

/**
 * One product and what its stock is worth, in **integer cents**.
 *
 * `quantity` travels with the value so the chart's table can show how many units
 * are behind each bar without recomputing it from the total.
 */
export type ProductValue = {
	id: string;
	name: string;
	quantity: number;
	cents: number;
};

/** The total value of the catalogue plus its rows, highest value first. */
export type InventoryValue = {
	totalCents: number;
	topProducts: ProductValue[];
};

/**
 * Reads the contract's decimal string (`"1500.00"`) as integer cents.
 *
 * The price is a `Decimal(12,2)` string, so the whole calculation stays in
 * integers: multiplying a float here would drift at the first rounding, and
 * summing many rows would then show a total nobody can reconcile. A single
 * decimal digit is padded (`"1500.5"` → `150050`) and a price with no decimals
 * is accepted (`"1500"` → `150000`).
 *
 * A value the contract does not allow returns `0` instead of throwing: one
 * malformed row must not take the whole chart down (same choice as
 * `formatPrice`).
 */
export function priceToCents(price: string): number {
	const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
	if (!match) {
		return 0;
	}

	const cents = (match[2] ?? "").padEnd(2, "0");
	return Number(match[1]) * 100 + Number(cents);
}

/**
 * Formats integer cents for display: `123456` → `"$ 1.234,56"`.
 *
 * Deliberately locale-free, like `formatPrice`: `Intl.NumberFormat` depends on
 * the runtime's ICU data, which differs between Node and the browser, so the
 * grouping and the decimal separator are fixed to the es-AR convention the rest
 * of the UI uses. The value never goes through a float.
 */
export function formatCents(cents: number): string {
	const wholeCents = Number.isFinite(cents) ? Math.trunc(cents) : 0;
	const sign = wholeCents < 0 ? "-" : "";
	const absolute = Math.abs(wholeCents);
	const whole = String(Math.trunc(absolute / 100)).replace(
		/\B(?=(\d{3})+(?!\d))/g,
		".",
	);
	const rest = String(absolute % 100).padStart(2, "0");

	return `${sign}$ ${whole},${rest}`;
}

/**
 * Computes the inventory value of the catalogue (S4): `price × stock` per
 * product, summed in integer cents.
 *
 * `topProducts` is ordered by value, highest first, with the name (and then the
 * id) breaking ties so the bars never reshuffle between renders. A product with
 * no stock contributes nothing to the total and is left out of the ranking: a
 * zero-length bar carries no information.
 */
export function inventoryValue(products: Product[]): InventoryValue {
	let totalCents = 0;
	const valued: ProductValue[] = [];

	for (const product of products) {
		const cents = priceToCents(product.price) * product.stockQuantity;
		totalCents += cents;

		if (cents > 0) {
			valued.push({
				id: product.id,
				name: product.name,
				quantity: product.stockQuantity,
				cents,
			});
		}
	}

	valued.sort(compareByValue);

	return { totalCents, topProducts: valued };
}

function compareByValue(left: ProductValue, right: ProductValue): number {
	if (left.cents !== right.cents) {
		return right.cents - left.cents;
	}
	if (left.name !== right.name) {
		return left.name < right.name ? -1 : 1;
	}
	if (left.id === right.id) {
		return 0;
	}

	return left.id < right.id ? -1 : 1;
}
