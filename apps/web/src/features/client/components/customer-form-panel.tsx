"use client";

import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { useCustomer } from "../api/use-customer";
import { CustomerForm } from "./customer-form";

const LOAD_ERROR_FALLBACK = "Probá de nuevo en unos segundos.";

/**
 * The inline panel the list opens for both writing flows.
 *
 * Creating needs no read, so the form renders right away. Editing reads the
 * customer first (`useCustomer`): the panel lives on the list page, where the
 * cache may be cold after a reload and the row could already be gone, and a
 * read gives the form its own source of truth. While that read is in flight the
 * panel shows a spinner; when it fails — the usual case being a `404
 * customer_not_found` from another tab's deletion — it says so and offers the
 * way back to the list instead of an empty form that would overwrite real data.
 */
export function CustomerFormPanel({
	companyId,
	customerId,
	onDone,
}: {
	companyId: string;
	customerId?: string;
	onDone: () => void;
}) {
	const detail = useCustomer(companyId, customerId);
	const isEdit = customerId !== undefined;

	return (
		<section
			aria-label={isEdit ? "Editar cliente" : "Nuevo cliente"}
			data-slot="customer-form-panel"
			className="flex w-full min-w-0 flex-col gap-4 rounded-xl border bg-surface p-4 sm:p-6"
		>
			<h2 className="text-lg font-bold text-text-primary">
				{isEdit ? "Editar cliente" : "Nuevo cliente"}
			</h2>

			{!isEdit ? (
				<CustomerForm
					companyId={companyId}
					onSaved={onDone}
					onCancel={onDone}
				/>
			) : detail.isPending ? (
				<div className="flex justify-center p-8">
					<SpinnerMotion />
				</div>
			) : detail.isError ? (
				<div className="flex flex-col gap-3">
					<Alert variant="danger" title="No pudimos cargar el cliente">
						{detail.error instanceof ApiError
							? detail.error.message
							: LOAD_ERROR_FALLBACK}
					</Alert>
					<div className="flex justify-end">
						<Button
							type="button"
							variant="outline"
							className="h-10 w-full sm:w-30"
							onClick={onDone}
						>
							Cancelar
						</Button>
					</div>
				</div>
			) : detail.data ? (
				<CustomerForm
					companyId={companyId}
					customer={detail.data}
					onSaved={onDone}
					onCancel={onDone}
				/>
			) : null}
		</section>
	);
}
