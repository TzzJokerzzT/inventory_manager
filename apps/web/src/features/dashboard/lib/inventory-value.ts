import type { ProductListItem } from "@/lib/api/schemas";

/**
 * One product and what its stock is worth at cost, in **integer cents**.
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

/**
 * The money the catalogue holds, in integer cents.
 *
 * `totalCents` and `marginPotentialCents` cover the **same subset** — the
 * products with a known `unitCost` — so the two figures can be read together.
 * `productsWithoutCost` counts what that subset left out, and `topProducts` is
 * the value of each included product, highest first.
 */
export type InventoryValue = {
	totalCents: number;
	marginPotentialCents: number;
	productsWithoutCost: number;
	topProducts: ProductValue[];
};

/**
 * Reads the contract's decimal string (`"1500.00"`) as integer cents.
 *
 * The amount is a `Decimal(12,2)` string, so the whole calculation stays in
 * integers: multiplying a float here would drift at the first rounding, and
 * summing many rows would then show a total nobody can reconcile. A single
 * decimal digit is padded (`"1500.5"` → `150050`) and an amount with no decimals
 * is accepted (`"1500"` → `150000`).
 *
 * The leading minus is part of the contract (`marginPerUnit` is negative when
 * the list price sits below the cost, L27) and it is preserved: the margin must
 * be able to say that the stock loses money. Nothing else about the sign is
 * accepted — `"+1500"` and `"- 1500"` are not the shape the API serializes.
 *
 * A value the contract does not allow returns `0` instead of throwing: one
 * malformed row must not take the whole chart down (same choice as
 * `formatPrice`).
 */
export function priceToCents(price: string): number {
	const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
	if (!match) {
		return 0;
	}

	const cents = (match[3] ?? "").padEnd(2, "0");
	const absolute = Number(match[2]) * 100 + Number(cents);

	return match[1] === "-" ? -absolute : absolute;
}

/**
 * Formats integer cents for display: `123456` → `"$ 1.234,56"`.
 *
 * Deliberately locale-free, like `formatPrice`: `Intl.NumberFormat` depends on
 * the runtime's ICU data, which differs between Node and the browser, so the
 * grouping and the decimal separator are fixed to the es-AR convention the rest
 * of the UI uses. The value never goes through a float.
 *
 * A negative amount keeps its sign in front of the symbol
 * (`-1950000` → `"-$ 19.500,00"`): the potential margin can be negative (L27) and
 * this is the single formatter every money figure in the dashboard uses.
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
 * Values the catalogue **at cost** (L27): `unitCost × stock` per product, summed
 * in integer cents, plus the potential margin of that same stock.
 *
 * `unitCost` is the average cost of the **available** units (L12), so multiplying
 * it by `stockQuantity` counts what the company has, not what it had. The listed
 * `price` never enters this calculation: it is what one unit is sold for, and
 * using it here would report a profit as if it were an asset.
 *
 * A product with stock and **no known cost** (no lots yet) is not worth zero:
 * it contributes to neither figure and is counted in `productsWithoutCost`, so
 * the UI can say so instead of stating a false total (L11).
 *
 * `topProducts` is ordered by value, highest first, with the name (and then the
 * id) breaking ties so the bars never reshuffle between renders. A product worth
 * nothing is left out of the ranking: a zero-length bar carries no information,
 * and the bars must add up to `totalCents` to the cent (L27).
 */
export function inventoryValue(products: ProductListItem[]): InventoryValue {
	let totalCents = 0;
	let marginPotentialCents = 0;
	let productsWithoutCost = 0;
	const valued: ProductValue[] = [];

	for (const product of products) {
		if (product.unitCost === null) {
			// No cost is not a zero cost: the row leaves both figures alone.
			if (product.stockQuantity > 0) {
				productsWithoutCost += 1;
			}
			continue;
		}

		const cents = priceToCents(product.unitCost) * product.stockQuantity;
		totalCents += cents;

		// The contract pairs a known `unitCost` with a known `marginPerUnit`, so
		// this branch only guards a row that broke that promise: its cost still
		// counts, and its margin stays unknown rather than becoming zero.
		if (product.marginPerUnit !== null) {
			marginPotentialCents +=
				priceToCents(product.marginPerUnit) * product.stockQuantity;
		}

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

	return {
		totalCents,
		marginPotentialCents,
		productsWithoutCost,
		topProducts: valued,
	};
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
