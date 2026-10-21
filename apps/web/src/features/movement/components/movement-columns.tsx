import type { Column } from "@/components/design-system";
import type { StockMovement } from "@/lib/api/schemas";
import { formatMovementDate } from "../lib/format-movement-date";
import { MovementTypeBadge } from "./movement-type-badge";

/** Shown when the movement has no reason: the field is optional on purpose. */
const NO_REASON = "Sin motivo";

/** Shown when the API could not resolve the user behind the movement. */
const NO_ACTOR = "Sin usuario";

/**
 * Shown when the movement has no customer: an entry, or a sale without an
 * identified customer. A sale does not stop being a sale because nobody was
 * named, so the cell says "no customer" instead of hiding the column value.
 */
const NO_CUSTOMER = "—";

/**
 * The history table: type, product, SKU, quantity, reason, customer, user and
 * date.
 *
 * The columns live in the feature, not in `src/utils/Columns.tsx`: those are the
 * mock tables, and a view only reads the columns it owns. Every cell reads from
 * the contract — the product and the customer come resolved by the API
 * (`product.name`/`sku`, `customer.name`), so the table never joins a cached
 * catalogue that could be stale, and a customer soft-deleted after the sale
 * still shows the name the ledger recorded (MI-10). The date is formatted
 * without a locale so tests and the browser agree.
 */
export const movementColumns: Column<StockMovement>[] = [
	{
		key: "type",
		header: "Tipo",
		render: (row) => <MovementTypeBadge type={row.type} />,
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
		key: "customer",
		header: "Cliente",
		render: (row) => (
			<span className="block max-w-[16rem] truncate">
				{row.customer?.name ?? NO_CUSTOMER}
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
	{
		key: "createdAt",
		header: "Fecha",
		render: (row) => formatMovementDate(row.createdAt),
	},
];
