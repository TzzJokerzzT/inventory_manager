import { type Column, StockBadge } from "@/components/design-system";
import type { Product } from "@/lib/api/schemas";
import { formatPrice } from "@/src/features/product/lib/format-price";
import { stockStatusFor } from "../lib/stock-status";

/**
 * Columns of the critical stock summary (S3), over the real product contract.
 *
 * The rows are the products the dashboard already filtered as critical, so the
 * table does not filter again: one predicate feeds the KPI, the alerts and this
 * list. The category is a dash because the category feature does not exist yet —
 * every product still has a null `categoryId` — and showing an empty cell would
 * read as missing data instead of a feature that is not there.
 */
export const stockColumns: Column<Product>[] = [
	{ key: "name", header: "Producto" },
	{ key: "sku", header: "SKU" },
	{
		key: "categoryId",
		header: "Categoría",
		render: () => "—",
	},
	{
		key: "price",
		header: "Precio",
		align: "right",
		render: (row) => formatPrice(row.price),
	},
	{ key: "stockQuantity", header: "Unidades", align: "right" },
	{
		key: "status",
		header: "Estado",
		render: (row) => <StockBadge status={stockStatusFor(row)} />,
	},
];
