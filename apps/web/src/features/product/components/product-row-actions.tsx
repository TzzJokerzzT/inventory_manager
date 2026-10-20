"use client";

import { cn } from "cn";
import Link from "next/link";
import { useState } from "react";
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
 * The actions column: edit and delete, the delete behind a two-step
 * confirmation rendered inline.
 *
 * `window.confirm` is never used: a native dialog blocks the page and cannot be
 * driven by a test. The confirmation is local state, so the mutation only runs
 * after the second click, and the row re-renders from the invalidated catalogue
 * instead of a local copy.
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

	if (confirming) {
		return (
			<div className="flex flex-col items-end gap-1">
				<div className="flex items-center gap-2">
					<span className="text-xs text-text-secondary">
						¿Eliminar {product.name}?
					</span>
					<Button
						type="button"
						size="xs"
						variant="danger"
						disabled={remove.isPending}
						onClick={() => remove.mutate({ productId: product.id })}
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
			<Link
				href={`/dashboard/products/${product.id}/edit`}
				className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
			>
				Editar
			</Link>
			<Button
				type="button"
				size="sm"
				variant="ghost"
				className="text-danger-text hover:bg-danger-soft"
				onClick={() => setConfirming(true)}
			>
				Eliminar
			</Button>
		</div>
	);
}
