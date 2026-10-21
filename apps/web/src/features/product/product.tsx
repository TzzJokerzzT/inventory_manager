"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert, type Column, DataTable } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { Product as ProductModel } from "@/lib/api/schemas";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { useActiveCompany } from "../company/store/company-selectors";
import { useMe } from "../user/api/use-me";
import { useProducts } from "./api/use-products";
import { ProductRowActions } from "./components/product-row-actions";
import { formatPrice } from "./lib/format-price";
import { canManageProducts, roleForCompany } from "./lib/product-permissions";
import { useDebouncedValue } from "./lib/use-debounced-value";
import { ProductSearch } from "./product-search";

const LOAD_ERROR_FALLBACK = "Probá de nuevo en unos segundos.";

/**
 * The products list (MI-21).
 *
 * It reads the real catalogue of the **active company**: `useActiveCompany()`
 * picks the company, `useMe()` supplies the caller's role for it, and
 * `useProducts()` reads the rows. The role decides what is offered — a MEMBER
 * reads the catalogue but gets no "Nuevo Producto", Editar or Eliminar, because
 * the API would answer `403 insufficient_role` — while the API stays the real
 * guard.
 *
 * The search box is debounced so each keystroke does not fire a request; the
 * query key includes the term, so a filtered read never overwrites the
 * unfiltered one.
 */
export function Product() {
	const company = useActiveCompany();
	const { data: me } = useMe();
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);

	const companyId = company?.id;
	const term = debouncedSearch.trim();
	const products = useProducts(companyId, debouncedSearch);
	const canManage = canManageProducts(roleForCompany(me, companyId));
	const rows = products.data ?? [];

	const columns: Column<ProductModel>[] = [
		{
			key: "name",
			header: "Producto",
			render: (row) => (
				<span className="flex items-center gap-3">
					{row.photoUrl ? (
						/* biome-ignore lint/performance/noImgElement: la entrega remota es de Cloudinary */
						<img
							src={row.photoUrl}
							alt=""
							aria-hidden="true"
							className="size-8 shrink-0 rounded object-cover"
						/>
					) : null}
					<span className="truncate">{row.name}</span>
				</span>
			),
		},
		{ key: "sku", header: "SKU" },
		{
			key: "price",
			header: "Precio",
			align: "right",
			// The price is a decimal string in the contract; it is formatted, never parsed as a float.
			render: (row) => formatPrice(row.price),
		},
		{ key: "stockQuantity", header: "Unidades", align: "right" },
	];

	if (canManage) {
		columns.push({
			key: "actions",
			header: "Acciones",
			align: "right",
			render: (row) =>
				companyId ? (
					<ProductRowActions companyId={companyId} product={row} />
				) : null,
		});
	}

	const emptyMessage =
		term === ""
			? "Todavía no cargaste productos. Creá el primero con «Nuevo Producto»."
			: `No encontramos productos para «${term}».`;

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
				subTitle={`${rows.length} productos en ${company?.name ?? "Sin empresa"}`}
			>
				{canManage ? (
					<Link href="/dashboard/products/create" className="w-full sm:w-auto">
						<Button className="h-12 w-full sm:w-auto">
							<Plus className="mr-2 size-5" />
							Nuevo Producto
						</Button>
					</Link>
				) : null}
			</ViewHeader>

			<ProductSearch value={search} onChange={setSearch} />

			<SectionTitle ariaLabel="Catálogo" title="Catálogo">
				{companyId === undefined ? (
					<p className="text-sm text-text-muted">
						Seleccioná una empresa para ver sus productos.
					</p>
				) : products.isPending ? (
					<div className="flex justify-center p-8">
						<SpinnerMotion />
					</div>
				) : products.isError ? (
					<Alert variant="danger" title="No pudimos cargar los productos">
						{products.error instanceof ApiError
							? products.error.message
							: LOAD_ERROR_FALLBACK}
					</Alert>
				) : (
					<DataTable
						columns={columns}
						rows={rows}
						getRowKey={(row) => row.id}
						emptyMessage={emptyMessage}
					/>
				)}
			</SectionTitle>
		</LazyMotionTag>
	);
}
