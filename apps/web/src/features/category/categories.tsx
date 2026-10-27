"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert, type Column, DataTable } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import {
	canManageProducts,
	roleForCompany,
} from "@/src/features/product/lib/product-permissions";
import { useMe } from "@/src/features/user/api/use-me";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { useCategories } from "./api/use-categories";
import { CategoryRowActions } from "./components/category-row-actions";

const LOAD_ERROR_FALLBACK = "Probá de nuevo en unos segundos.";

const LIST_HREF = "/dashboard/categories";

/**
 * The company's category catalogue (S6).
 *
 * It reads the real categories of the **active company**: `useActiveCompany()`
 * picks the company, `useMe()` supplies the caller's role for it, and
 * `useCategories()` reads the rows, already ordered by `name` and then `id` by
 * the server. Reading is open to every ACTIVE member — the catalogue is what the
 * product form needs — while the writes are guarded by `manage_products`, so a
 * MEMBER sees the table with no «Nueva categoría», Editar or Eliminar, exactly
 * like the suppliers roster.
 *
 * Writing happens **on its own pages**: «Nueva categoría» and «Editar» navigate
 * to `/dashboard/categories/create` and `/dashboard/categories/[id]/edit`, so a
 * reload or a shared link lands on the form. Both read what they need from this
 * same catalogue — the contract has no per-category read.
 */
export function Categories() {
	const router = useRouter();
	const company = useActiveCompany();
	const { data: me } = useMe();

	const companyId = company?.id;
	const categories = useCategories(companyId);
	const canManage = canManageProducts(roleForCompany(me, companyId));
	const rows = categories.data ?? [];

	function goToCreate() {
		router.push(`${LIST_HREF}/create`);
	}

	function goToEdit(category: Category) {
		router.push(`${LIST_HREF}/${category.id}/edit`);
	}

	const columns: Column<Category>[] = [
		{
			key: "name",
			header: "Nombre",
			render: (row) => <span className="truncate">{row.name}</span>,
		},
	];

	if (canManage && companyId) {
		columns.push({
			key: "actions",
			header: "Acciones",
			align: "right",
			render: (row) => (
				<CategoryRowActions
					companyId={companyId}
					category={row}
					onEdit={goToEdit}
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
				title="Categorías"
				className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
				subTitle={`${rows.length} ${
					rows.length === 1 ? "categoría" : "categorías"
				} en ${company?.name ?? "Sin empresa"}`}
			>
				{canManage ? (
					<Button
						type="button"
						className="h-12 w-full sm:w-auto"
						disabled={companyId === undefined}
						onClick={goToCreate}
					>
						<Plus className="mr-2 size-5" />
						Nueva categoría
					</Button>
				) : null}
			</ViewHeader>

			<SectionTitle ariaLabel="Catálogo de categorías" title="Catálogo">
				{companyId === undefined ? (
					<p className="text-sm text-text-muted">
						Seleccioná una empresa para ver sus categorías.
					</p>
				) : categories.isPending ? (
					<div className="flex justify-center p-8">
						<SpinnerMotion />
					</div>
				) : categories.isError ? (
					<Alert variant="danger" title="No pudimos cargar las categorías">
						{categories.error instanceof ApiError
							? categories.error.message
							: LOAD_ERROR_FALLBACK}
					</Alert>
				) : (
					<DataTable
						columns={columns}
						rows={rows}
						getRowKey={(row) => row.id}
						emptyMessage="Todavía no hay categorías."
					/>
				)}
			</SectionTitle>
		</LazyMotionTag>
	);
}
