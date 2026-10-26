import type { Column } from "@/components/design-system";
import type { StockMovement } from "@/lib/api/schemas";
import {
	formatCents,
	priceToCents,
} from "@/src/features/dashboard/lib/inventory-value";
import { MoneyValue } from "@/src/features/product/components/money-value";
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
 * Lo que se anuncia cuando el monto no existe: una entrada no tiene precio
 * escrito, y una venta anterior a la feature no tiene ni precio ni costo (S9).
 */
const NO_PRICE = "Sin precio";
const NO_MARGIN = "Sin margen";

/** A total needs the written price: without it the amount is unknown, never `0`. */
const NO_TOTAL = "Sin total";

/**
 * The history table: type, product, SKU, quantity, applied price, total, margin,
 * reason, customer, user and date.
 *
 * The columns live in the feature, not in `src/utils/Columns.tsx`: those are the
 * mock tables, and a view only reads the columns it owns. Every cell reads from
 * the contract — the product and the customer come resolved by the API
 * (`product.name`/`sku`, `customer.name`), so the table never joins a cached
 * catalogue that could be stale, and a customer soft-deleted after the sale
 * still shows the name the ledger recorded (MI-10). The date is formatted
 * without a locale so tests and the browser agree. The total of a row is the
 * written price times its quantity, in integer cents, and it is unknown — never
 * zero — for an entry or a sale that wrote no price.
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
	// L26: el precio **aplicado** en la venta (no el de lista) y el margen que
	// dejó, calculado por el servidor (L11). Una entrada, o una venta anterior a
	// la feature, no tiene esos datos: la celda dice "—", nunca `0`.
	{
		key: "unitPrice",
		header: "Precio",
		align: "right",
		render: (row) => (
			<MoneyValue value={row.unitPrice} unknownLabel={NO_PRICE} />
		),
	},
	{
		key: "total",
		header: "Total",
		align: "right",
		// `unitPrice × quantity` in integer cents: the price travels as a
		// `Decimal(12,2)` string, so multiplying a float would drift at the first
		// cent. An entry, or a sale older than the written price, has no amount:
		// the cell says "no total" instead of `0`.
		render: (row) =>
			row.unitPrice === null ? (
				<MoneyValue value={null} unknownLabel={NO_TOTAL} />
			) : (
				<span className="whitespace-nowrap">
					{formatCents(priceToCents(row.unitPrice) * row.quantity)}
				</span>
			),
	},
	{
		key: "margin",
		header: "Margen",
		align: "right",
		render: (row) => <MoneyValue value={row.margin} unknownLabel={NO_MARGIN} />,
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
