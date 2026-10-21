"use client";

import { cn } from "cn";
import { SquarePen, Trash } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/design-system";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import type { Product } from "@/lib/api/schemas";
import { useDeleteProduct } from "../api/use-delete-product";

const DELETE_FALLBACK = "No pudimos eliminar el producto.";

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

/**
 * The actions column: edit and delete, the delete behind a confirmation modal.
 *
 * `window.confirm` is never used: a native dialog blocks the page and cannot be
 * driven by a test. The confirmation is `Modal`'s `open` state, so the mutation
 * only runs from the dialog's confirm button and the row re-renders from the
 * invalidated catalogue instead of a local copy.
 */
export function ProductRowActions({
	companyId,
	product,
}: {
	companyId: string;
	product: Product;
}) {
	const [confirming, setConfirming] = useState(false);
	const remove = useDeleteProduct(companyId);
	const error = deleteErrorMessage(remove.error);

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
				open={confirming}
				onOpenChange={setConfirming}
				title="Eliminar producto"
				description={`${product.name} se quitará del catálogo. El producto no se borra de forma definitiva: deja de aparecer en el listado.`}
				footer={
					<>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => setConfirming(false)}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							size="sm"
							variant="danger"
							disabled={remove.isPending}
							onClick={() =>
								remove.mutate(
									{ productId: product.id },
									{ onSuccess: () => setConfirming(false) },
								)
							}
						>
							Eliminar
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
