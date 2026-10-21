import type { Product } from "@/lib/api/schemas";

/** How the catalogue splits between products that ran out and the rest. */
export type StockStatusCounts = {
	outOfStock: number;
	inStock: number;
};

/**
 * Counts the catalogue by stock status (S2).
 *
 * The chart is by **status**, not by category, because the category feature does
 * not exist yet: every product has a null `categoryId`, so a per-category donut
 * would show a single "Sin categoría" slice. The cut is the one the ticket cares
 * about — stock `0` against stock `> 0`; the low-stock threshold belongs to the
 * alerts, not to this chart.
 */
export function stockStatusCounts(products: Product[]): StockStatusCounts {
	let outOfStock = 0;
	let inStock = 0;

	for (const product of products) {
		if (product.stockQuantity > 0) {
			inStock += 1;
		} else {
			outOfStock += 1;
		}
	}

	return { outOfStock, inStock };
}

/**
 * The badge a single product earns: sold out, low stock or healthy.
 *
 * Sold out wins over low stock even when the threshold is 0, so a product with no
 * units is never labelled with the softer warning. The critical predicate is the
 * dashboard's (`stockQuantity <= lowStockThreshold`), so the table's Estado and
 * the critical-stock KPI always agree.
 */
export function stockStatusFor(
	product: Product,
): "out_of_stock" | "low_stock" | "in_stock" {
	if (product.stockQuantity === 0) {
		return "out_of_stock";
	}
	if (product.stockQuantity <= product.lowStockThreshold) {
		return "low_stock";
	}

	return "in_stock";
}
