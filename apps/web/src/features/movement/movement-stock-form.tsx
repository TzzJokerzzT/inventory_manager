"use client";

import { type FormEvent, useRef, useState } from "react";
import { Alert, AutoComplete, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { RegisterMovementResponse } from "@/lib/api/schemas";
import { useProducts } from "@/src/features/product/api/use-products";
import { useRegisterMovement } from "./api/use-register-movement";
import type { MovementType } from "./components/movement-type-badge";
import { normalizeReason, validateMovement } from "./lib/validate-movement";

const FALLBACK_ERROR = "No pudimos registrar el movimiento. Probá de nuevo.";

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
		return error.message;
	}
	return error ? FALLBACK_ERROR : undefined;
}

/**
 * What the server answered after a successful registration: the stock **after**
 * the movement, straight from the transaction (MOV-04). Computing it here from
 * the cached product would be a second source of truth for the same number.
 */
function successMessage(response: RegisterMovementResponse): string {
	return `${response.quantity} unidades de ${response.product.name}. Stock disponible: ${response.stockQuantity}.`;
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

	const [productId, setProductId] = useState("");
	const [quantity, setQuantity] = useState("");
	const [reason, setReason] = useState("");
	const [attempted, setAttempted] = useState(false);
	const quantityRef = useRef<HTMLInputElement>(null);

	const copy = COPY[type];
	const options = (catalogue.data ?? []).map((product) => ({
		value: product.id,
		label: `${product.name} · ${product.sku}`,
	}));
	const errors = attempted
		? validateMovement({ productId, quantity, reason })
		: {};
	const errorMessage = registrationErrorMessage(register.error);
	const success = register.isSuccess ? register.data : undefined;

	function reset() {
		setProductId("");
		setQuantity("");
		setReason("");
		setAttempted(false);
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setAttempted(true);

		const nextErrors = validateMovement({ productId, quantity, reason });
		if (Object.keys(nextErrors).length > 0) {
			if (nextErrors.quantity) {
				quantityRef.current?.focus();
			}
			return;
		}

		register.mutate(
			{
				productId,
				type,
				quantity: Number(quantity),
				reason: normalizeReason(reason),
			},
			{ onSuccess: reset },
		);
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
					disabled={register.isPending}
				/>
				{errors.productId ? (
					<p role="alert" className="text-xs text-danger-text">
						{errors.productId}
					</p>
				) : null}
			</div>

			<TextField
				ref={quantityRef}
				label="Cantidad"
				name="quantity"
				inputMode="numeric"
				placeholder="20"
				autoComplete="off"
				value={quantity}
				onChange={(event) => setQuantity(event.target.value)}
				error={errors.quantity}
				hint="Unidades enteras, mayor que cero."
				disabled={register.isPending}
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
				disabled={register.isPending}
			/>

			{errorMessage ? (
				<div className="col-span-full">
					<Alert variant="danger" title="No pudimos registrar el movimiento">
						{errorMessage}
					</Alert>
				</div>
			) : null}

			{success ? (
				<div className="col-span-full">
					<Alert variant="success" title={copy.title}>
						{successMessage(success)}
					</Alert>
				</div>
			) : null}

			<div className="col-span-full flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
				<Button
					type="button"
					className="h-10 w-full sm:w-30"
					variant="outline"
					disabled={register.isPending}
					onClick={reset}
				>
					Cancelar
				</Button>
				<Button
					className="h-10 w-full sm:w-30"
					type="submit"
					disabled={register.isPending}
				>
					{register.isPending ? (
						<>
							<SpinnerMotion size={16} className="mr-2" />
							{copy.pending}
						</>
					) : (
						copy.submit
					)}
				</Button>
			</div>
		</form>
	);
}
