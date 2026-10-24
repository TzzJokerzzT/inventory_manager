"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Alert, type Column, DataTable } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { SupplierListItem } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { formatPrice } from "@/src/features/product/lib/format-price";
import {
	canManageProducts,
	roleForCompany,
} from "@/src/features/product/lib/product-permissions";
import { useMe } from "@/src/features/user/api/use-me";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { useProviders } from "./api/use-providers";
import { ProviderFormPanel } from "./components/provider-form-panel";
import { ProviderRowActions } from "./components/provider-row-actions";
import { measureUnitLabel } from "./lib/measure-unit";

const LOAD_ERROR_FALLBACK = "Probá de nuevo en unos segundos.";

/** What an absent optional contact shows, so a cell is never blank. */
const EMPTY_VALUE = "—";

/** Shown when the company never bought from that supplier: never a fake row. */
const NO_LOTS = "Sin compras";

/**
 * The suppliers roster (T7, slice F1).
 *
 * It reads the real suppliers of the **active company**: `useActiveCompany()`
 * picks the company, `useMe()` supplies the caller's role for it, and
 * `useProviders()` reads the rows, already ordered by `name` and then `id` by
 * the server. The roster is what a purchase needs — which supplier, and at what
 * price per measure the last lot arrived — so **any** ACTIVE member reads it;
 * the writes are guarded by `manage_products`, so a MEMBER sees the table with
 * no «Nuevo Proveedor», Editar or Eliminar, exactly like the catalogue.
 *
 * Writing happens **on this page**: «Nuevo Proveedor» and «Editar» open the same
 * inline form panel above the table, so there is no route to navigate to. The
 * edit form starts from the row itself because the contract has no per-supplier
 * read.
 *
 * The last lot column is `null` for a supplier the company never bought from,
 * and it never renders a `$/medida` without its unit: the price means nothing
 * without knowing whether it is per kg, per litre or per metre.
 */
export function Providers() {
	const company = useActiveCompany();
	const { data: me } = useMe();
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [editing, setEditing] = useState<SupplierListItem | undefined>(
		undefined,
	);

	const companyId = company?.id;
	const providers = useProviders(companyId);
	const canManage = canManageProducts(roleForCompany(me, companyId));
	const rows = providers.data ?? [];

	function openCreateForm() {
		setEditing(undefined);
		setIsFormOpen(true);
	}

	function openEditForm(provider: SupplierListItem) {
		setEditing(provider);
		setIsFormOpen(true);
	}

	function closeForm() {
		setIsFormOpen(false);
		setEditing(undefined);
	}

	const columns: Column<SupplierListItem>[] = [
		{
			key: "name",
			header: "Nombre",
			render: (row) => <span className="truncate">{row.name}</span>,
		},
		{
			key: "contact",
			header: "Contacto",
			render: (row) => (
				<span className="block max-w-[20rem] truncate">
					{row.contact ?? EMPTY_VALUE}
				</span>
			),
		},
		{
			key: "lastLot",
			header: "Último lote",
			align: "right",
			render: (row) =>
				row.lastLot === null
					? NO_LOTS
					: `${formatPrice(row.lastLot.costPerMeasure)} por ${measureUnitLabel(
							row.lastLot.measureUnit,
						)}`,
		},
	];

	if (canManage && companyId) {
		columns.push({
			key: "actions",
			header: "Acciones",
			align: "right",
			render: (row) => (
				<ProviderRowActions
					companyId={companyId}
					provider={row}
					onEdit={openEditForm}
				/>
			),
		});
	}

	return (
		<LazyMotionTag
			tag="div"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="flex min-w-0 flex-col gap-4 sm:gap-6"
		>
			<ViewHeader
				title="Proveedores"
				className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
				subTitle={`${rows.length} proveedores en ${company?.name ?? "Sin empresa"}`}
			>
				{canManage ? (
					<Button
						type="button"
						className="h-12 w-full sm:w-auto"
						disabled={companyId === undefined}
						aria-expanded={isFormOpen && editing === undefined}
						onClick={
							isFormOpen && editing === undefined ? closeForm : openCreateForm
						}
					>
						<Plus className="mr-2 size-5" />
						Nuevo Proveedor
					</Button>
				) : null}
			</ViewHeader>

			{isFormOpen && companyId && canManage ? (
				<ProviderFormPanel
					companyId={companyId}
					provider={editing}
					onDone={closeForm}
				/>
			) : null}

			<SectionTitle ariaLabel="Padrón de proveedores" title="Padrón">
				{companyId === undefined ? (
					<p className="text-sm text-text-muted">
						Seleccioná una empresa para ver sus proveedores.
					</p>
				) : providers.isPending ? (
					<div className="flex justify-center p-8">
						<SpinnerMotion />
					</div>
				) : providers.isError ? (
					<Alert variant="danger" title="No pudimos cargar los proveedores">
						{providers.error instanceof ApiError
							? providers.error.message
							: LOAD_ERROR_FALLBACK}
					</Alert>
				) : (
					<DataTable
						columns={columns}
						rows={rows}
						getRowKey={(row) => row.id}
						emptyMessage="Todavía no cargaste proveedores. Creá el primero con «Nuevo Proveedor»."
					/>
				)}
			</SectionTitle>
		</LazyMotionTag>
	);
}
