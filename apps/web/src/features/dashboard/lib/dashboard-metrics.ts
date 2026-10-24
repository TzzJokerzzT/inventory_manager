import type { MovementTrendPoint, ProductListItem } from "@/lib/api/schemas";
import { inventoryValue } from "./inventory-value";

/**
 * The numbers the dashboard shows, all derived from the active company's data.
 *
 * Every field has a real source: the catalogue (`GET /products`, which already
 * returns the whole list unpaginated, with the costs derived from its available
 * units) and the movement trend report (one point per UTC day). No field is a
 * sample value.
 */
export type DashboardMetrics = {
	/** Size of the catalogue (DASH-01). */
	totalProducts: number;
	/** `unitCost × stock` of the whole catalogue, summed in integer cents (L27). */
	inventoryValueCents: number;
	/**
	 * `marginPerUnit × stock` over the same products, in integer cents. Signed:
	 * stock bought above its list price loses money (L27).
	 */
	marginPotentialCents: number;
	/**
	 * Products with stock but no known `unitCost`, which therefore contribute to
	 * neither figure (L27). They are reported apart, never as a zero cost (L11).
	 */
	productsWithoutCost: number;
	/** Products where `stockQuantity <= lowStockThreshold` (L4). */
	criticalCount: number;
	/** Critical products with no units at all. */
	outOfStockCount: number;
	/** Critical products that still have units but are at or below their threshold. */
	lowStockOnlyCount: number;
	/** `entries + exits` of today's point (UTC), `0` when the series is empty. */
	unitsToday: number;
};

/** The metrics plus the rows of the critical stock table (S3). */
export type DashboardMetricsResult = DashboardMetrics & {
	/** The critical products, by units ascending and then by name. */
	criticalProducts: ProductListItem[];
};

/**
 * Whether a product is critical: it has no more units than its threshold.
 *
 * The comparison is `<=` on purpose (L4) and not `=== 0`: today the threshold is
 * always 0, so this is the set of sold-out products, and the day MI-12 lets the
 * user edit the threshold the "stock bajo" products join the same set without a
 * change here.
 */
export function isCritical(product: ProductListItem): boolean {
	return product.stockQuantity <= product.lowStockThreshold;
}

/**
 * Derives every dashboard number from the catalogue and the trend series.
 *
 * A single pass over the products fills the counters and the critical rows at
 * the same time, so the KPI, the alerts and the table can never disagree: they
 * are the same predicate. The money comes from {@link inventoryValue} instead of
 * being recomputed here, so the KPI, the margin card and the MI-14 chart always
 * show the same totals to the cent — including how many products had no cost to
 * contribute (L27).
 */
export function dashboardMetrics(
	products: ProductListItem[],
	series: MovementTrendPoint[],
): DashboardMetricsResult {
	let criticalCount = 0;
	let outOfStockCount = 0;
	let lowStockOnlyCount = 0;
	const criticalProducts: ProductListItem[] = [];

	for (const product of products) {
		if (!isCritical(product)) {
			continue;
		}

		criticalCount += 1;
		criticalProducts.push(product);

		if (product.stockQuantity === 0) {
			outOfStockCount += 1;
		} else {
			lowStockOnlyCount += 1;
		}
	}

	criticalProducts.sort(compareByUnitsThenName);

	const value = inventoryValue(products);

	// The series arrives oldest first, so the last point is today's (UTC). An
	// empty series means the server had no day to report, not "no movements", so
	// the safe reading of "moved today" is zero.
	const today = series[series.length - 1];

	return {
		totalProducts: products.length,
		inventoryValueCents: value.totalCents,
		marginPotentialCents: value.marginPotentialCents,
		productsWithoutCost: value.productsWithoutCost,
		criticalCount,
		outOfStockCount,
		lowStockOnlyCount,
		unitsToday: today ? today.entries + today.exits : 0,
		criticalProducts,
	};
}

function compareByUnitsThenName(
	left: ProductListItem,
	right: ProductListItem,
): number {
	if (left.stockQuantity !== right.stockQuantity) {
		return left.stockQuantity - right.stockQuantity;
	}
	if (left.name === right.name) {
		return 0;
	}

	return left.name < right.name ? -1 : 1;
}
