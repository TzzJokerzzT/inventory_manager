"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import {
	type Column,
	DataTable,
	StockBadge,
	TextField,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { useActiveCompany } from "../company/store/company-selectors";
import { type StockRow, stockTableRows } from "../dashboard/mock";

const stockColumns: Column<StockRow>[] = [
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

export function Product() {
	const company = useActiveCompany();

	return (
		<LazyMotionTag
			tag="div"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="flex flex-col gap-6"
		>
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-text-primary">Productos</h1>
					<p className="mt-1 text-sm text-text-secondary">
						500 productos activos en{" "}
						<span className="font-medium text-text-primary">
							{company?.name ?? "Sin empresa"}
						</span>
					</p>
				</div>
				<Link href="/dashboard/products/create">
					<Button className="h-12">
						<Plus className="mr-2 size-5" />
						Nuevo Producto
					</Button>
				</Link>
			</header>

			<section
				aria-label="Búsqueda de productos"
				className="flex items-start gap-3"
			>
				<div className="min-w-0">
					<TextField
						type="text"
						name="productSearch"
						placeholder="Buscar por nombre o SKU"
						autoComplete="text"
						className="w-[35rem]"
					/>
				</div>
			</section>

			<section aria-label="Stock" className="flex flex-col gap-3">
				<h2 className="text-lg font-bold text-text-primary">Stock crítico</h2>
				<DataTable
					columns={stockColumns}
					rows={stockTableRows}
					getRowKey={(row) => row.sku}
				/>
			</section>
		</LazyMotionTag>
	);
}
