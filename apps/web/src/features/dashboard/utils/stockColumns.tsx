import { type Column, StockBadge } from "@/components/design-system";
import type { StockRow } from "@/src/utils/mockData";

export const stockColumns: Column<StockRow>[] = [
	{ key: "name", header: "Producto" },
	{ key: "sku", header: "SKU" },
	{ key: "category", header: "Categoría" },
	{ key: "price", header: "Precio", align: "right" },
	{ key: "units", header: "Unidades", align: "right" },
	{
		key: "status",
		header: "Estado",
		render: (row) => <StockBadge status={row.status} />,
	},
];
