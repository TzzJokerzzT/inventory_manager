"use client";

import { cn } from "cn";
import { SquarePen, Trash, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/design-system";
import { Button, buttonVariants } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { Product } from "@/lib/api/schemas";
import { AlertToast } from "@/src/shared/components/AlertToast";
import { useDeleteProduct } from "../api/use-delete-product";
import { useRestoreProduct } from "../api/use-restore-product";

const DELETE_FALLBACK = "No pudimos eliminar el producto.";
const RESTORE_FALLBACK = "No pudimos restaurar el producto.";

/**
 * Which actions the row offers: the catalogue's (edit and delete) or the
 * trash's (restore only).
 */
export type ProductRowActionsMode = "active" | "trash";

/**
 * Maps the API `code` to a readable message; unknown codes keep the server's.
 *
 * `insufficient_role` and `product_not_found` already arrive with a
 * user-facing Spanish message, so they are surfaced as-is: the UI never has to
 * explain a failure the caller could not have avoided.
 */
function deleteErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		return error.message;
	}
	return error ? DELETE_FALLBACK : undefined;
}

/** Same rule for the trash: the server's message wins when it has one. */
function restoreErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		return error.message;
	}
	return error ? RESTORE_FALLBACK : undefined;
}

/**
 * The actions column.
 *
 * In the catalogue it offers edit and delete, the delete behind a confirmation
 * modal. In the trash (`mode="trash"`) it offers **only** restore: the trash is a
 * state, so editing or deleting a row from it makes no sense, and restoring is a
 * safe, reversible action that asks for no confirmation — one click runs it.
 *
 * `window.confirm` is never used: a native dialog blocks the page and cannot be
 * driven by a test. The confirmation is `Modal`'s `open` state, so the mutation
 * only runs from the dialog's confirm button and the row re-renders from the
 * invalidated catalogue instead of a local copy.
 */
export function ProductRowActions({
	companyId,
	product,
	mode = "active",
}: {
	companyId: string;
	product: Product;
	mode?: ProductRowActionsMode;
}) {
	const [confirming, setConfirming] = useState(false);
	const remove = useDeleteProduct(companyId);
	const restore = useRestoreProduct(companyId);
	const error = deleteErrorMessage(remove.error);
	const restoreError = restoreErrorMessage(restore.error);

	if (mode === "trash") {
		return (
			<div className="flex flex-col items-end gap-2">
				<Button
					type="button"
					size="sm"
					variant="ghost"
					disabled={restore.isPending}
					onClick={() =>
						restore.mutate(
							{ productId: product.id },
							{
								onSuccess: () => {
									AlertToast({
										title: "Producto restaurado",
										description: `Producto ${product.name} volvió al catálogo.`,
										type: "success",
										delay: 3000,
									});
								},
							},
						)
					}
				>
					{restore.isPending ? (
						<>
							<SpinnerMotion size={20} className="mr-2" />
							Restaurando...
						</>
					) : (
						<>
							<Undo2 size={20} className="mr-2" aria-hidden="true" />
							Restaurar
						</>
					)}
				</Button>
				{restoreError ? (
					<p role="alert" className="text-sm text-danger-text">
						{restoreError}
					</p>
				) : null}
			</div>
		);
	}

	return (
		<>
			<div className="flex items-center justify-end gap-2">
				<Link
					href={`/dashboard/products/${product.id}/edit`}
					aria-label="Editar"
					className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
				>
					<SquarePen size={30} />
				</Link>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					aria-label="Eliminar"
					className="text-danger-text hover:bg-danger-soft"
					onClick={() => setConfirming(true)}
				>
					<Trash size={30} />
				</Button>
			</div>

			<Modal
				key={product.id}
				open={confirming}
				onOpenChange={setConfirming}
				title="Eliminar producto"
				description={`${product.name} se quitará del catálogo. El producto no se borra de forma definitiva: deja de aparecer en el listado.`}
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
									{ productId: product.id },
									{
										onSuccess: () => {
											setConfirming(false);
											AlertToast({
												title: "Producto eliminado",
												description: `Producto ${product.name} ha sido eliminado del catálogo.`,
												type: "success",
												delay: 3000,
											});
										},
									},
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
