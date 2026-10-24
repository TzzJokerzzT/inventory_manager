"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert, type Column, DataTable } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
// The catalogue row, not the bare product: the list carries the costs and the
// margin derived from the available units (L12), and this view renders them.
import type { ProductListItem as ProductModel } from "@/lib/api/schemas";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { useActiveCompany } from "../company/store/company-selectors";
import { useMe } from "../user/api/use-me";
import { useProducts } from "./api/use-products";
import { MoneyValue } from "./components/money-value";
import { ProductRowActions } from "./components/product-row-actions";
import { formatPrice } from "./lib/format-price";
import {
	canManageProducts,
	canPurgeProducts,
	roleForCompany,
} from "./lib/product-permissions";
import { useDebouncedValue } from "./lib/use-debounced-value";
import { ProductSearch } from "./product-search";

const LOAD_ERROR_FALLBACK = "Probá de nuevo en unos segundos.";

/**
 * Lo que se anuncia en lugar del guión cuando el producto no tiene unidades
 * disponibles: sin unidades no hay costo pagado ni margen (L11).
 */
const NO_UNIT_COST = "Sin costo";
const NO_UNIT_MARGIN = "Sin margen";

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
 * The **Papelera** toggle swaps the list for the soft-deleted products (the same
 * read with `deleted=true`). In the trash every row offers Restaurar, which asks
 * for no confirmation because it is safe and reversible, and the catalogue's
 * create/edit/delete are hidden: they belong to the active catalogue, not to a
 * product that is already deleted. The irreversible purge — Eliminar
 * definitivamente — is offered there too, but only to an OWNER
 * ({@link canPurgeProducts}), behind its own confirmation modal.
 *
 * The search box is debounced so each keystroke does not fire a request; the
 * query key includes the term and the mode, so a filtered read never overwrites
 * the unfiltered one and the trash never overwrites the catalogue.
 *
 * The money columns are the **sale price of one unit**, its **cost** and its
 * **margin**, which are comparable with each other (L26); the `$/medida` of the
 * last purchase is deliberately absent, because it is compared against other
 * suppliers and not against the price of a unit (L20). A cost the API could not
 * derive — a product with no available units — is an em dash with a spoken
 * reason, never a `0` (L11).
 */
export function Product() {
	const company = useActiveCompany();
	const { data: me } = useMe();
	const [search, setSearch] = useState("");
	const [showTrash, setShowTrash] = useState(false);
	const debouncedSearch = useDebouncedValue(search, 300);

	const companyId = company?.id;
	const term = debouncedSearch.trim();
	const products = useProducts(
		companyId,
		debouncedSearch,
		showTrash ? { deleted: true } : undefined,
	);
	const canManage = canManageProducts(roleForCompany(me, companyId));
	const canPurge = canPurgeProducts(roleForCompany(me, companyId));
	const rows = products.data ?? [];

	const columns: Column<ProductModel>[] = [
		{
			key: "name",
			header: "Producto",
			// The name is the only free-text column: bounding it keeps the new money
			// columns readable and lets the table scroll horizontally on a phone
			// (`data-table`) instead of stretching the page.
			className: "max-w-[18rem]",
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
					<span className="min-w-0 truncate">{row.name}</span>
				</span>
			),
		},
		{ key: "sku", header: "SKU" },
		{
			key: "price",
			header: "Precio",
			align: "right",
			// The price is a decimal string in the contract; it is formatted, never
			// parsed as a float. It carries no unit on purpose: this column is the
			// SALE price of one unit, while `measureUnit` says how the product is
			// BOUGHT (its lots are weighed). Appending "/ kg" here would price a
			// unit as if it were a kilogram, which is the confusion this feature
			// exists to remove; the purchase form is where the measure belongs.
			render: (row) => (
				<span className="whitespace-nowrap">{formatPrice(row.price)}</span>
			),
		},
		// L26: el costo y el margen de **una unidad**, que es contra lo que se
		// compara el precio de venta de arriba. El $/medida no entra acá: se
		// compara contra el de otros proveedores, no contra el precio de una
		// unidad (L20), y ese número vive en la compra y en el padrón.
		{
			key: "unitCost",
			header: "Costo por unidad",
			align: "right",
			render: (row) => (
				<MoneyValue value={row.unitCost} unknownLabel={NO_UNIT_COST} />
			),
		},
		{
			key: "marginPerUnit",
			header: "Margen por unidad",
			align: "right",
			render: (row) => (
				<MoneyValue value={row.marginPerUnit} unknownLabel={NO_UNIT_MARGIN} />
			),
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
					<ProductRowActions
						companyId={companyId}
						product={row}
						mode={showTrash ? "trash" : "active"}
						canPurge={canPurge}
					/>
				) : null,
		});
	}

	const emptyMessage = showTrash
		? term === ""
			? "No hay productos en la papelera."
			: `No encontramos productos para «${term}» en la papelera.`
		: term === ""
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
				subTitle={
					showTrash
						? `${rows.length} productos en la papelera de ${company?.name ?? "Sin empresa"}`
						: `${rows.length} productos en ${company?.name ?? "Sin empresa"}`
				}
			>
				{canManage && !showTrash ? (
					<Link href="/dashboard/products/create" className="w-full sm:w-auto">
						<Button className="h-12 w-full sm:w-auto">
							<Plus className="mr-2 size-5" />
							Nuevo Producto
						</Button>
					</Link>
				) : null}
			</ViewHeader>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<ProductSearch value={search} onChange={setSearch} />
				<ButtonGroup
					role="group"
					aria-label="Vista de productos"
					className="w-full sm:w-auto"
				>
					<Button
						type="button"
						variant={showTrash ? "outline" : "default"}
						aria-pressed={!showTrash}
						className="h-10 flex-1 sm:flex-none"
						onClick={() => setShowTrash(false)}
					>
						Catálogo
					</Button>
					<Button
						type="button"
						variant={showTrash ? "default" : "outline"}
						aria-pressed={showTrash}
						className="h-10 flex-1 sm:flex-none"
						onClick={() => setShowTrash(true)}
					>
						Papelera
					</Button>
				</ButtonGroup>
			</div>

			<SectionTitle
				ariaLabel={showTrash ? "Papelera" : "Catálogo"}
				title={showTrash ? "Papelera" : "Catálogo"}
			>
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
