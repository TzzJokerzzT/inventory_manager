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
import { usePurgeProduct } from "../api/use-purge-product";
import { useRestoreProduct } from "../api/use-restore-product";

const DELETE_FALLBACK = "No pudimos eliminar el producto.";
const RESTORE_FALLBACK = "No pudimos restaurar el producto.";
const PURGE_FALLBACK = "No pudimos eliminar el producto definitivamente.";

/**
 * Which actions the row offers: the catalogue's (edit and delete) or the
 * trash's (restore, plus the OWNER-only purge).
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
 * The purge's failures are exactly the ones the server explains best —
 * `product_has_movements` carries the movement count — so the API message is
 * shown as-is when there is one.
 */
function purgeErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		return error.message;
	}
	return error ? PURGE_FALLBACK : undefined;
}

/**
 * The actions column.
 *
 * In the catalogue it offers edit and delete, the delete behind a confirmation
 * modal. In the trash (`mode="trash"`) it offers **only** restore, which is a
 * safe, reversible action that asks for no confirmation — one click runs it —
 * plus, only when `canPurge` says so (OWNER), the permanent delete behind the
 * same kind of confirmation modal. Editing or soft-deleting a row from the trash
 * makes no sense, so neither is offered there.
 *
 * `window.confirm` is never used: a native dialog blocks the page and cannot be
 * driven by a test. The confirmation is `Modal`'s `open` state, so the mutation
 * only runs from the dialog's confirm button and the row re-renders from the
 * invalidated catalogue instead of a local copy. The purge's `409` is shown
 * **inside** its dialog, because that is where the decision was made.
 */
export function ProductRowActions({
	companyId,
	product,
	mode = "active",
	canPurge = false,
}: {
	companyId: string;
	product: Product;
	mode?: ProductRowActionsMode;
	/** Offer the irreversible purge; the API is the real guard (OWNER only). */
	canPurge?: boolean;
}) {
	const [confirming, setConfirming] = useState(false);
	const [confirmingPurge, setConfirmingPurge] = useState(false);
	const remove = useDeleteProduct(companyId);
	const restore = useRestoreProduct(companyId);
	const purge = usePurgeProduct(companyId);
	const error = deleteErrorMessage(remove.error);
	const restoreError = restoreErrorMessage(restore.error);
	const purgeError = purgeErrorMessage(purge.error);

	if (mode === "trash") {
		return (
			<div className="flex flex-col items-end gap-2">
				<div className="flex flex-wrap items-center justify-end gap-2">
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
					{canPurge ? (
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="text-danger-text hover:bg-danger-soft"
							aria-label="Eliminar definitivamente"
							onClick={() => setConfirmingPurge(true)}
						>
							<Trash size={30} aria-hidden="true" />
						</Button>
					) : null}
				</div>
				{restoreError ? (
					<p role="alert" className="text-sm text-danger-text">
						{restoreError}
					</p>
				) : null}
				{canPurge ? (
					<Modal
						open={confirmingPurge}
						onOpenChange={setConfirmingPurge}
						title="Eliminar definitivamente"
						description={`${product.name} se borrará de forma definitiva. Esta acción es irreversible y solo se permite cuando el producto no tiene movimientos.`}
						footer={
							<>
								<Button
									type="button"
									size="lg"
									variant="ghost"
									onClick={() => setConfirmingPurge(false)}
									className="h-10 w-full sm:w-40"
								>
									Cancelar
								</Button>
								<Button
									type="button"
									size="lg"
									variant="danger"
									disabled={purge.isPending}
									className="h-10 w-full sm:w-40"
									onClick={() =>
										purge.mutate(
											{ productId: product.id },
											{
												onSuccess: () => {
													setConfirmingPurge(false);
													AlertToast({
														title: "Producto eliminado definitivamente",
														description: `Producto ${product.name} se borró de forma definitiva.`,
														type: "success",
														delay: 3000,
													});
												},
											},
										)
									}
								>
									{purge.isPending ? (
										<SpinnerMotion size={20} className="mr-2" />
									) : null}
									Eliminar definitivamente
								</Button>
							</>
						}
					>
						{purgeError ? (
							<p role="alert" className="text-sm text-danger-text">
								{purgeError}
							</p>
						) : null}
					</Modal>
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
