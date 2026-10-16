import { type Column, StockBadge } from "@/components/design-system";
import type { movementRow, StockRow } from "./mockData";

export const stockColumns: Column<StockRow>[] = [
	{ key: "name", header: "Producto" },
	{ key: "sku", header: "SKU" },
	{ key: "category", header: "Categoría" },
	{ key: "price", header: "Precio", align: "left" },
	{ key: "units", header: "Unidades" },
	{
		key: "status",
		header: "Estado",
		render: (row) => <StockBadge status={row.status} />,
	},
	{ key: "actions", header: "Acciones" },
];

export const movementColumns: Column<movementRow>[] = [
	{ key: "date", header: "Fecha" },
	{ key: "type", header: "Tipo" },
	{ key: "product", header: "Producto" },
	{ key: "quantity", header: "Cantidad" },
	{ key: "user", header: "Usuario" },
];
