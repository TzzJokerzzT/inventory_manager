"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Alert, type Column, DataTable } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { Customer as CustomerModel } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useDebouncedValue } from "@/src/features/product/lib/use-debounced-value";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { useCustomers } from "./api/use-customers";
import { CustomerFormPanel } from "./components/customer-form-panel";
import { CustomerRowActions } from "./components/customer-row-actions";
import { CustomerSearch } from "./components/customer-search";

const LOAD_ERROR_FALLBACK = "Probá de nuevo en unos segundos.";

/** What an absent optional contact field shows, so a cell is never blank. */
const EMPTY_VALUE = "—";

/**
 * The customers list (MI-11).
 *
 * It reads the real customers of the **active company**: `useActiveCompany()`
 * picks the company and `useCustomers()` reads the rows, already ordered by
 * `name` and then `id` by the server. Any ACTIVE membership writes customers, so
 * the write actions are offered to everyone in the company — the API's
 * `requireCompanyContext` stays the real guard.
 *
 * Writing happens **on this page**: «Nuevo Cliente» and «Editar» open the same
 * inline form panel above the table, so there is no route to navigate to and no
 * round-trip through the router state. The form reads the customer it edits with
 * `useCustomer`, which keeps it correct with a cold cache.
 *
 * The search box is debounced so each keystroke does not fire a request; the
 * query key includes the term, so a filtered read never overwrites the
 * unfiltered one. There are no "Compras"/"Total" columns: they depend on
 * associating customers with outbound movements (CLI-04), which is out of scope.
 */
export function Client() {
	const company = useActiveCompany();
	const [search, setSearch] = useState("");
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | undefined>(undefined);
	const debouncedSearch = useDebouncedValue(search, 300);

	const companyId = company?.id;
	const term = debouncedSearch.trim();
	const customers = useCustomers(companyId, debouncedSearch);
	const rows = customers.data ?? [];

	function openCreateForm() {
		setEditingId(undefined);
		setIsFormOpen(true);
	}

	function openEditForm(customer: CustomerModel) {
		setEditingId(customer.id);
		setIsFormOpen(true);
	}

	function closeForm() {
		setIsFormOpen(false);
		setEditingId(undefined);
	}

	const columns: Column<CustomerModel>[] = [
		{
			key: "name",
			header: "Nombre",
			render: (row) => <span className="truncate">{row.name}</span>,
		},
		{
			key: "email",
			header: "Email",
			render: (row) => row.email ?? EMPTY_VALUE,
		},
		{
			key: "phone",
			header: "Teléfono",
			render: (row) => row.phone ?? EMPTY_VALUE,
		},
		{
			key: "address",
			header: "Dirección",
			render: (row) => row.address ?? EMPTY_VALUE,
		},
	];

	if (companyId) {
		columns.push({
			key: "actions",
			header: "Acciones",
			align: "right",
			render: (row) => (
				<CustomerRowActions
					companyId={companyId}
					customer={row}
					onEdit={openEditForm}
				/>
			),
		});
	}

	const emptyMessage =
		term === ""
			? "Todavía no cargaste clientes. Creá el primero con «Nuevo Cliente»."
			: `No encontramos clientes para «${term}».`;

	return (
		<LazyMotionTag
			tag="div"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="flex min-w-0 flex-col gap-4 sm:gap-6"
		>
			<ViewHeader
				title="Clientes"
				className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
				subTitle={`${rows.length} clientes en ${company?.name ?? "Sin empresa"}`}
			>
				<Button
					type="button"
					className="h-12 w-full sm:w-auto"
					disabled={companyId === undefined}
					aria-expanded={isFormOpen && editingId === undefined}
					onClick={
						isFormOpen && editingId === undefined ? closeForm : openCreateForm
					}
				>
					<Plus className="mr-2 size-5" />
					Nuevo Cliente
				</Button>
			</ViewHeader>

			{isFormOpen && companyId ? (
				<CustomerFormPanel
					companyId={companyId}
					customerId={editingId}
					onDone={closeForm}
				/>
			) : null}

			<CustomerSearch
				value={search}
				onChange={setSearch}
				disabled={companyId === undefined}
			/>

			<SectionTitle ariaLabel="Padrón de clientes" title="Padrón">
				{companyId === undefined ? (
					<p className="text-sm text-text-muted">
						Seleccioná una empresa para ver sus clientes.
					</p>
				) : customers.isPending ? (
					<div className="flex justify-center p-8">
						<SpinnerMotion />
					</div>
				) : customers.isError ? (
					<Alert variant="danger" title="No pudimos cargar los clientes">
						{customers.error instanceof ApiError
							? customers.error.message
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
