"use client";

import { ReceiptText, SquarePen, Trash } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import type { Customer } from "@/lib/api/schemas";
import { useDeleteCustomer } from "../api/use-delete-customer";

const DELETE_FALLBACK = "No pudimos eliminar el cliente.";

/**
 * Maps the API failure to a readable message; unknown errors get a neutral one.
 *
 * `customer_not_found` and `company_access_forbidden` already arrive with a
 * user-facing Spanish message, so they are surfaced as-is: the UI never has to
 * explain a failure the caller could not have avoided.
 */
function deleteErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		return error.message;
	}
	return error ? DELETE_FALLBACK : undefined;
}

/**
 * The actions column: detail opens the read-only panel for that customer's
 * sales, edit opens the inline form and delete sits behind a two-step
 * confirmation rendered in place.
 *
 * `window.confirm` is never used: a native dialog blocks the page and cannot be
 * driven by a test. The confirmation is local state, so the mutation only runs
 * after the second click, and the row disappears from the invalidated list
 * instead of a local copy.
 */
export function CustomerRowActions({
	companyId,
	customer,
	onEdit,
	onDetail,
}: {
	companyId: string;
	customer: Customer;
	onEdit: (customer: Customer) => void;
	onDetail: (customer: Customer) => void;
}) {
	const [confirming, setConfirming] = useState(false);
	const remove = useDeleteCustomer(companyId);
	const error = deleteErrorMessage(remove.error);

	if (confirming) {
		return (
			<div className="flex flex-col items-end gap-1">
				<div className="flex items-center gap-2">
					<span className="text-xs text-text-secondary">
						¿Eliminar {customer.name}?
					</span>
					<Button
						type="button"
						size="xs"
						variant="danger"
						disabled={remove.isPending}
						onClick={() => remove.mutate({ customerId: customer.id })}
					>
						Confirmar
					</Button>
					<Button
						type="button"
						size="xs"
						variant="ghost"
						onClick={() => setConfirming(false)}
					>
						Cancelar
					</Button>
				</div>
				{error ? (
					<p role="alert" className="text-xs text-danger-text">
						{error}
					</p>
				) : null}
			</div>
		);
	}

	return (
		<div className="flex items-center justify-end gap-2">
			<Button
				type="button"
				size="icon-lg"
				variant="ghost"
				aria-label="Detalle"
				onClick={() => onDetail(customer)}
			>
				<ReceiptText aria-hidden="true" />
			</Button>
			<Button
				type="button"
				size="icon-lg"
				variant="ghost"
				aria-label="Editar"
				onClick={() => onEdit(customer)}
			>
				<SquarePen aria-hidden="true" />
			</Button>
			<Button
				type="button"
				size="icon-lg"
				variant="ghost"
				aria-label="Eliminar"
				className="text-danger-text hover:bg-danger-soft"
				onClick={() => setConfirming(true)}
			>
				<Trash aria-hidden="true" />
			</Button>
		</div>
	);
}
