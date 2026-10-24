"use client";

import { SquarePen, Trash } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { SupplierListItem } from "@/lib/api/schemas";
import { useDeleteProvider } from "../api/use-delete-provider";

const DELETE_FALLBACK = "No pudimos eliminar el proveedor.";

/**
 * Maps the API failure to a readable message; unknown errors get a neutral one.
 *
 * `supplier_not_found` and `insufficient_role` already arrive with a message the
 * caller can read, and the first one is what a second tab's deletion produces,
 * so the UI never explains a failure the person could not have avoided.
 */
function deleteErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		return error.message;
	}
	return error ? DELETE_FALLBACK : undefined;
}

/**
 * The actions column: edit navigates to that supplier's route and delete sits
 * behind a confirmation dialog.
 *
 * The confirmation is the design-system `Modal`, not `window.confirm`: a native
 * dialog blocks the page and cannot be driven by a test. `open` is local state,
 * so the mutation only runs from the dialog's confirm button, and the row
 * disappears from the invalidated roster instead of from a local copy. The
 * dialog is shown only to a caller that may write at all — a MEMBER gets no
 * actions column — and the API stays the real guard.
 */
export function ProviderRowActions({
	companyId,
	provider,
	onEdit,
}: {
	companyId: string;
	provider: SupplierListItem;
	onEdit: (provider: SupplierListItem) => void;
}) {
	const [confirming, setConfirming] = useState(false);
	const remove = useDeleteProvider(companyId);
	const error = deleteErrorMessage(remove.error);

	return (
		<>
			<div className="flex items-center justify-end gap-2">
				<Button
					type="button"
					size="icon-lg"
					variant="ghost"
					aria-label="Editar"
					onClick={() => onEdit(provider)}
				>
					<SquarePen aria-hidden="true" />
				</Button>
				<Button
					type="button"
					size="icon-lg"
					variant="ghost"
					className="text-danger-text hover:bg-danger-soft"
					aria-label="Eliminar"
					onClick={() => setConfirming(true)}
				>
					<Trash aria-hidden="true" />
				</Button>
			</div>

			<Modal
				key={provider.id}
				open={confirming}
				onOpenChange={setConfirming}
				title="Eliminar proveedor"
				description={`${provider.name} se quitará del padrón. El proveedor no se borra de forma definitiva: deja de aparecer en el listado y su nombre queda reservado.`}
				footer={
					<>
						<Button
							type="button"
							size="lg"
							variant="ghost"
							onClick={() => setConfirming(false)}
							className="h-10 w-full sm:w-40"
						>
							Cancelar
						</Button>
						<Button
							type="button"
							size="lg"
							variant="danger"
							disabled={remove.isPending}
							className="h-10 w-full sm:w-40"
							onClick={() =>
								remove.mutate(
									{ supplierId: provider.id },
									{ onSuccess: () => setConfirming(false) },
								)
							}
						>
							{remove.isPending ? (
								<>
									<SpinnerMotion size={20} className="mr-2" />
									Eliminando...
								</>
							) : (
								"Eliminar"
							)}
						</Button>
					</>
				}
			>
				{error ? (
					<p role="alert" className="text-sm text-danger-text">
						{error}
					</p>
				) : null}
			</Modal>
		</>
	);
}
