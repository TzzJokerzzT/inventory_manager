"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { stockTableRows } from "@/src/utils/mockData";
import { useActiveCompany } from "../company/store/company-selectors";
import { stockColumns } from "../dashboard/utils/stockColumns";
import { ProductSearch } from "./product-search";

export function Product() {
	const company = useActiveCompany();

	return (
		<LazyMotionTag
			tag="div"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="flex min-w-0 flex-col gap-4 sm:gap-6"
		>
			<ViewHeader
				title="Productos"
				className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
				subTitle={`${stockColumns.length} productos activos en ${company?.name ?? "Sin empresa"}`}
			>
				<Link href="/dashboard/products/create" className="w-full sm:w-auto">
					<Button className="h-12 w-full sm:w-auto">
						<Plus className="mr-2 size-5" />
						Nuevo Producto
					</Button>
				</Link>
			</ViewHeader>

			<ProductSearch />

			<SectionTitle ariaLabel="Stock" title="Stock">
				<DataTable
					columns={stockColumns}
					rows={stockTableRows}
					getRowKey={(row) => row.sku}
				/>
			</SectionTitle>
		</LazyMotionTag>
	);
}
