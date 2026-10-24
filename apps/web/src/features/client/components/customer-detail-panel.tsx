"use client";

import { Alert, type Column, DataTable } from "@/components/design-system";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { Customer, StockMovement } from "@/lib/api/schemas";
import { useMovements } from "@/src/features/movement/api/use-movements";
import { formatMovementDate } from "@/src/features/movement/lib/format-movement-date";

const LOAD_ERROR_FALLBACK = "Probá de nuevo en unos segundos.";

/** What an absent optional contact field shows, so a line is never blank. */
const EMPTY_VALUE = "—";

/** Shown when the sale has no reason: the field is optional on purpose. */
const NO_REASON = "Sin motivo";

/** Shown when the API could not resolve the user behind the sale. */
const NO_ACTOR = "Sin usuario";

const EMPTY_MESSAGE = "Este cliente todavía no tiene salidas registradas.";

/**
 * The sales table of one customer: date, product, SKU, quantity, reason and
 * user.
 *
 * Every cell reads from the contract — the product comes resolved by the API
 * (`product.name`/`sku`) and the user from `actor` — so the panel never joins a
 * cached catalogue that could be stale, and a product renamed after the sale
 * still shows the name the ledger recorded. The type column is left out on
 * purpose: every row here is an exit, by the filter the panel sends.
 */
const salesColumns: Column<StockMovement>[] = [
	{
		key: "createdAt",
		header: "Fecha",
		render: (row) => formatMovementDate(row.createdAt),
	},
	{
		key: "product",
		header: "Producto",
		render: (row) => (
			<span className="block max-w-[18rem] truncate">{row.product.name}</span>
		),
	},
	{ key: "sku", header: "SKU", render: (row) => row.product.sku },
	{
		key: "quantity",
		header: "Cantidad",
		align: "right",
		render: (row) => String(row.quantity),
	},
	{
		key: "reason",
		header: "Motivo",
		render: (row) => (
			<span className="block max-w-[20rem] truncate">
				{row.reason ?? NO_REASON}
			</span>
		),
	},
	{
		key: "actor",
		header: "Usuario",
		// `fullName` is nullable for a user created by Auth0 without a display
		// name; the email is the identifier the fallback shows.
		render: (row) => row.actor?.fullName ?? row.actor?.email ?? NO_ACTOR,
	},
];

/** One labeled contact field, `—` when the customer left it empty. */
function ContactField({
	label,
	value,
}: {
	label: string;
	value: string | null;
}) {
	return (
		<div className="flex flex-col gap-1">
			<dt className="text-xs font-medium uppercase text-text-muted">{label}</dt>
			<dd className="text-sm text-text-primary">{value ?? EMPTY_VALUE}</dd>
		</div>
	);
}

/**
 * The read-only detail of one customer, rendered by its own page
 * (`/dashboard/clients/[id]/details`); the page owns the way back and the read,
 * so this panel only paints what it is given. The sales are the company's
 * history narrowed with `customerId` and `type: "OUT"`:
 * there is no per-customer endpoint, and this view never touches the movements
 * page. It shows no money totals because a movement does not store a price; the
 * count of sales and the sum of units are the honest aggregate of what the
 * ledger recorded.
 */
export function CustomerDetailPanel({
	companyId,
	customer,
}: {
	companyId: string;
	customer: Customer;
}) {
	const sales = useMovements(companyId, {
		customerId: customer.id,
		type: "OUT",
	});
	const rows = sales.data ?? [];
	const totalUnits = rows.reduce((total, row) => total + row.quantity, 0);
	const salesLabel =
		rows.length === 1 ? "1 salida listada" : `${rows.length} salidas listadas`;
	const unitsLabel = totalUnits === 1 ? "1 unidad" : `${totalUnits} unidades`;

	return (
		<section
			aria-label="Detalle del cliente"
			data-slot="customer-detail-panel"
			className="flex w-full min-w-0 flex-col gap-4 rounded-xl border bg-surface p-4 sm:p-6"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex min-w-0 flex-col gap-1">
					<h2 className="text-lg font-bold text-text-primary">
						Detalle del cliente
					</h2>
					<p className="truncate text-sm text-text-secondary">
						{customer.name}
					</p>
				</div>
			</div>

			<dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<ContactField label="Email" value={customer.email} />
				<ContactField label="Teléfono" value={customer.phone} />
				<ContactField label="Dirección" value={customer.address} />
			</dl>

			<div className="flex flex-col gap-3">
				<h3 className="text-base font-bold text-text-primary">Salidas</h3>
				{sales.isPending ? (
					<div className="flex justify-center p-8">
						<SpinnerMotion />
					</div>
				) : sales.isError ? (
					<Alert variant="danger" title="No pudimos cargar las salidas">
						{sales.error instanceof ApiError
							? sales.error.message
							: LOAD_ERROR_FALLBACK}
					</Alert>
				) : (
					<>
						<p className="text-sm text-text-secondary">
							{`${salesLabel} · ${unitsLabel}`}
						</p>
						{/* The endpoint pages the history, so the counts describe what
						    this panel received; they never claim to be the customer's
						    whole lifetime total. */}
						<p className="text-xs text-text-muted">
							Se muestran las salidas más recientes.
						</p>
						<DataTable
							columns={salesColumns}
							rows={rows}
							getRowKey={(row) => row.id}
							emptyMessage={EMPTY_MESSAGE}
						/>
					</>
				)}
			</div>
		</section>
	);
}
