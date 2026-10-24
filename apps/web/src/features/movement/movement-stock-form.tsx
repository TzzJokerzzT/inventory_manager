"use client";

import { type FormEvent, useRef, useState } from "react";
import { AutoComplete, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { RegisterMovementRequest } from "@/lib/api/schemas";
import { useCustomers } from "@/src/features/client/api/use-customers";
import { useRegisterLot } from "@/src/features/lot/api/use-register-lot";
import { parseMeasures } from "@/src/features/lot/lib/parse-measures";
import { formatMeasure } from "@/src/features/lot/lib/purchase-summary";
import {
	normalizeCostPerMeasure,
	type PurchaseFormErrors,
	type PurchaseFormValues,
	validatePurchase,
} from "@/src/features/lot/lib/validate-purchase";
import { useProducts } from "@/src/features/product/api/use-products";
import { measureUnitLabel } from "@/src/features/product/lib/measure-unit";
import { AlertToast } from "@/src/shared/components/AlertToast";
import { useRegisterMovement } from "./api/use-register-movement";
import type { MovementType } from "./components/movement-type-badge";
import { normalizeReason, validateMovement } from "./lib/validate-movement";
import { MovementPurchaseBlock } from "./movement-purchase-block";

const FALLBACK_ERROR = "No pudimos registrar el movimiento. Probá de nuevo.";
const PURCHASE_FALLBACK_ERROR =
	"No pudimos registrar la compra. Probá de nuevo.";

/**
 * The empty value of the customer selector, shown as "Sin cliente".
 *
 * A sale without an identified customer is valid (S3), so "none" has to be a
 * real, selectable choice — not just the field left blank, which a person cannot
 * tell apart from "did not get to it". The empty string maps to
 * `customerId: null` on submit.
 */
const NO_CUSTOMER_VALUE = "";
const NO_CUSTOMER_LABEL = "Sin cliente";

/** The purchase block before the person typed anything. */
const EMPTY_PURCHASE: PurchaseFormValues = {
	supplierId: "",
	costPerMeasure: "",
	measures: "",
};

const COPY = {
	IN: {
		submit: "Registrar entrada",
		pending: "Registrando...",
		title: "Entrada registrada",
	},
	OUT: {
		submit: "Registrar salida",
		pending: "Registrando...",
		title: "Salida registrada",
	},
} as const;

/**
 * Turns the API's machine-readable `code` into something a person can act on.
 *
 * `insufficient_stock` keeps the server's message on purpose: it states the stock
 * available, which is the only number that tells the person what to do next — and
 * it comes from the transaction that refused the exit, not from a possibly stale
 * cache. A code we do not know falls back to the server's message, which is
 * already user-facing.
 */
function registrationErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		if (error.code === "product_not_found") {
			return "Ese producto ya no existe en el catálogo.";
		}
		if (error.code === "customer_not_found") {
			// Ajeno, inexistente y dado de baja comparten código: el mensaje no
			// distingue cuál fue, porque averiguarlo filtraría el padrón ajeno.
			return "Ese cliente ya no existe en el padrón.";
		}
		if (error.code === "customer_requires_exit") {
			return "Una entrada no puede llevar cliente: es una compra a proveedor, no una venta.";
		}
		return error.message;
	}
	return error ? FALLBACK_ERROR : undefined;
}

/**
 * The purchase failures, in Spanish.
 *
 * `supplier_not_found` and `product_not_found` are translated because their
 * contract text is a developer message; `insufficient_role` because it is the
 * one failure the person can act on (ask an owner or an admin). Any other code
 * falls back to the server's message, which is already user-facing.
 */
function purchaseErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		if (error.code === "supplier_not_found") {
			return "Ese proveedor ya no existe en esta empresa.";
		}
		if (error.code === "product_not_found") {
			return "Ese producto ya no existe en el catálogo.";
		}
		if (error.code === "insufficient_role") {
			return "Tu rol no permite esta acción.";
		}
		return error.message;
	}
	return error ? PURCHASE_FALLBACK_ERROR : undefined;
}

/**
 * The optional customer of a sale (MI-10 / CLI-04).
 *
 * It is its own component because the hook only runs where the field is
 * rendered: an entry is a purchase from a supplier, so the entry form never
 * reads the padrón and never sends a customer. The options come from the real
 * customer list (`useCustomers`), the same read the customers view uses, so a
 * customer added there is selectable here without a reload.
 */
function MovementCustomerField({
	companyId,
	value,
	onValueChange,
	disabled,
}: {
	companyId: string | undefined;
	value: string;
	onValueChange: (value: string) => void;
	disabled: boolean;
}) {
	const customers = useCustomers(companyId);

	const options = [
		{ value: NO_CUSTOMER_VALUE, label: NO_CUSTOMER_LABEL },
		...(customers.data ?? []).map((customer) => ({
			value: customer.id,
			label: customer.name,
		})),
	];

	return (
		<div className="flex min-w-0 flex-col gap-2 md:col-span-full xl:col-span-1 2xl:col-span-full">
			<AutoComplete
				label="Cliente"
				options={options}
				name="customer"
				placeholder="Buscá el cliente por nombre"
				emptyMessage="No hay clientes que coincidan."
				value={value}
				onValueChange={onValueChange}
				disabled={disabled}
			/>
			<p className="text-xs text-text-muted">
				Opcional: una venta sin cliente identificado sigue siendo válida.
			</p>
		</div>
	);
}

/**
 * The entry/exit form (MI-26): real product selector, quantity and optional
 * reason.
 *
 * One implementation for both directions because the fields, the validation and
 * the pending/error states are the same; what changes is the `type` sent — `IN`
 * for an entry, `OUT` for an exit — and the copy. The selector is fed by the real
 * catalogue of the active company (`useProducts`), shows `nombre · SKU` and sends
 * the product id, so the API never has to resolve a label back to a product.
 *
 * Validation mirrors the body rule (product required, quantity a positive integer
 * up to 1.000.000, reason ≤ 300) so an invalid body never reaches the server. On
 * success the mutation invalidates the history and the catalogue, so the table
 * refreshes and the stock shown elsewhere updates without a reload.
 *
 * An exit also offers the optional customer of the sale (MI-10): the selector is
 * only rendered for `OUT`, and the chosen customer — or `null` for "Sin cliente" —
 * travels as `customerId`. An entry has no customer at all, so the field is not
 * rendered and no key is sent.
 *
 * An entry also offers the optional purchase block (L21 / F2b), closed by default.
 * While it is closed the form is exactly the loose entry it was and submits
 * `POST /movements`. While it is open the quantity **is** the number of measures,
 * so that field is disabled and the submit registers the lot with `POST /lots`
 * (supplier, `$ por medida` and the measure of each unit) instead of a movement:
 * the server writes the lot, its units, the `IN` movement and the stock increment
 * in one transaction, which is why the client must not send both.
 */
export function MovementStockForm({
	companyId,
	type,
}: {
	companyId: string | undefined;
	type: MovementType;
}) {
	const catalogue = useProducts(companyId);
	const register = useRegisterMovement(companyId);
	const registerLot = useRegisterLot(companyId);

	const [productId, setProductId] = useState("");
	const [quantity, setQuantity] = useState("");
	const [reason, setReason] = useState("");
	const [customerId, setCustomerId] = useState(NO_CUSTOMER_VALUE);
	const [purchaseOpen, setPurchaseOpen] = useState(false);
	const [purchase, setPurchase] = useState<PurchaseFormValues>(EMPTY_PURCHASE);
	const [attempted, setAttempted] = useState(false);
	const quantityRef = useRef<HTMLInputElement>(null);

	const copy = COPY[type];
	const options = (catalogue.data ?? []).map((product) => ({
		value: product.id,
		label: `${product.name} · ${product.sku}`,
	}));

	/**
	 * Whether this submit registers a purchase lot instead of a movement (L21).
	 *
	 * Only an entry can be a purchase, and only while the block is open: with the
	 * block closed the form is the loose entry it always was.
	 */
	const purchaseActive = type === "IN" && purchaseOpen;
	const selectedProduct = (catalogue.data ?? []).find(
		(product) => product.id === productId,
	);
	const isPending = register.isPending || registerLot.isPending;

	const movementErrors = validateMovement({ productId, quantity, reason });
	if (purchaseActive) {
		// La cantidad SON las medidas: el campo está deshabilitado y su regla no
		// aplica a una compra.
		delete movementErrors.quantity;
	}
	const errors = attempted ? movementErrors : {};
	const purchaseErrors: PurchaseFormErrors =
		attempted && purchaseActive ? validatePurchase(purchase) : {};

	function reset() {
		setProductId("");
		setQuantity("");
		setReason("");
		setCustomerId(NO_CUSTOMER_VALUE);
		setPurchaseOpen(false);
		setPurchase(EMPTY_PURCHASE);
		setAttempted(false);
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setAttempted(true);

		const nextMovementErrors = validateMovement({
			productId,
			quantity,
			reason,
		});
		if (purchaseActive) {
			delete nextMovementErrors.quantity;
		}
		const nextPurchaseErrors = purchaseActive ? validatePurchase(purchase) : {};

		if (
			Object.keys(nextMovementErrors).length > 0 ||
			Object.keys(nextPurchaseErrors).length > 0
		) {
			if (nextMovementErrors.quantity) {
				quantityRef.current?.focus();
			}
			return;
		}

		if (purchaseActive) {
			const parsed = parseMeasures(purchase.measures);
			if (!parsed.ok) {
				// Inalcanzable después de `validatePurchase`, que devuelve el mismo
				// mensaje: la lista ya se validó arriba.
				return;
			}

			const unitLabel = selectedProduct
				? measureUnitLabel(selectedProduct.measureUnit)
				: "medida";

			registerLot.mutate(
				{
					productId,
					supplierId: purchase.supplierId,
					costPerMeasure: normalizeCostPerMeasure(purchase.costPerMeasure),
					measures: parsed.measures,
					note: normalizeReason(reason),
				},
				{
					onSuccess: (lot) => {
						reset();
						// Las cifras son las del servidor: él deriva la medida total del lote
						// y reparte el costo de cada unidad (L6, S3).
						AlertToast({
							title: "Compra registrada",
							description: `Lote registrado: ${lot.unitCount} unidades · ${formatMeasure(lot.measureTotal)} ${unitLabel}.`,
							type: "success",
							delay: 3000,
						});
					},
					onError: (error) => {
						AlertToast({
							title: "Error en la compra",
							description:
								purchaseErrorMessage(error) ??
								"Intentá de nuevo en unos minutos.",
							type: "error",
							delay: 3000,
						});
					},
				},
			);
			return;
		}

		const body: RegisterMovementRequest = {
			productId,
			type,
			quantity: Number(quantity),
			reason: normalizeReason(reason),
		};
		if (type === "OUT") {
			// "Sin cliente" viaja como `null` explícito: la venta es anónima, no una
			// asociación pendiente. Una entrada no lleva la clave.
			body.customerId = customerId === NO_CUSTOMER_VALUE ? null : customerId;
		}

		register.mutate(body, {
			onSuccess: (response) => {
				reset();
				// The stock comes from the transaction's response, not from the
				// cached catalogue: it is the number the server actually wrote (MOV-04).
				AlertToast({
					title: "Registro exitoso",
					description: `${type === "IN" ? "Entrada" : "Salida"} registrada. Stock disponible: ${response.stockQuantity}.`,
					type: "success",
					delay: 3000,
				});
			},
			onError: (error) => {
				// The callback argument is the error of *this* attempt; reading
				// `register.error` here would be the previous render's value.
				AlertToast({
					title: "Error en el registro",
					description:
						registrationErrorMessage(error) ??
						"Intentá de nuevo en unos minutos.",
					type: "error",
					delay: 3000,
				});
			},
		});
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			data-slot="movement-stock-form"
			aria-label={copy.submit}
			className="grid w-full min-w-0 grid-cols-1 gap-4 rounded-xl border bg-surface p-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
		>
			<div className="flex min-w-0 flex-col gap-2 md:col-span-full xl:col-span-1 2xl:col-span-full">
				<AutoComplete
					label="Producto"
					options={options}
					name="product"
					placeholder="Buscá el producto por nombre o SKU"
					emptyMessage="No hay productos que coincidan."
					value={productId}
					onValueChange={setProductId}
					disabled={isPending}
				/>
				{errors.productId ? (
					<p role="alert" className="text-xs text-danger-text">
						{errors.productId}
					</p>
				) : null}
			</div>

			{type === "IN" ? (
				<MovementPurchaseBlock
					companyId={companyId}
					product={selectedProduct}
					open={purchaseOpen}
					onOpenChange={setPurchaseOpen}
					values={purchase}
					onValueChange={(patch) =>
						setPurchase((previous) => ({ ...previous, ...patch }))
					}
					errors={purchaseErrors}
					disabled={isPending}
				/>
			) : null}

			<TextField
				ref={quantityRef}
				label="Cantidad"
				name="quantity"
				inputMode="numeric"
				placeholder="20"
				autoComplete="off"
				value={quantity}
				onChange={(event) => setQuantity(event.target.value)}
				error={purchaseActive ? undefined : errors.quantity}
				hint={
					purchaseActive
						? "La cantidad son las medidas de la compra."
						: "Unidades enteras, mayor que cero."
				}
				disabled={isPending || purchaseActive}
			/>

			<TextField
				label="Motivo"
				name="reason"
				type="text"
				placeholder="Compra a proveedor"
				autoComplete="off"
				value={reason}
				onChange={(event) => setReason(event.target.value)}
				error={errors.reason}
				disabled={isPending}
			/>

			{type === "OUT" ? (
				<MovementCustomerField
					companyId={companyId}
					value={customerId}
					onValueChange={setCustomerId}
					disabled={isPending}
				/>
			) : null}

			<div className="col-span-full flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
				<Button
					type="button"
					className="h-10 w-full sm:w-30"
					variant="outline"
					disabled={isPending}
					onClick={reset}
				>
					Cancelar
				</Button>
				<Button
					className="h-10 w-full sm:w-40"
					type="submit"
					disabled={isPending}
				>
					{isPending ? (
						<>
							<SpinnerMotion size={16} className="mr-2" />
							{copy.pending}
						</>
					) : purchaseActive ? (
						"Registrar compra"
					) : (
						copy.submit
					)}
				</Button>
			</div>
		</form>
	);
}
