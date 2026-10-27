"use client";

import { SquarePen, Trash } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/schemas";
import { useDeleteCategory } from "../api/use-delete-category";

const DELETE_FALLBACK = "No pudimos eliminar la categoría.";

/**
 * Maps the API failure to a readable message; unknown errors get a neutral one.
 *
 * Unlike the supplier dialog this one does **not** re-word the API's own
 * sentence: `409 category_in_use` carries the number of products still using the
 * category, and that count is the whole reason the delete was refused (S6), so
 * the message is shown as the server sent it. `insufficient_role` and
 * `category_not_found` already arrive readable for the same reason.
 */
function deleteErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		return error.message;
	}
	return error ? DELETE_FALLBACK : undefined;
}

/**
 * The actions column: edit navigates to that category's route and delete sits
 * behind a confirmation dialog.
 *
 * The confirmation is the design-system `Modal`, not `window.confirm`: a native
 * dialog blocks the page and cannot be driven by a test. `open` is local state,
 * so the mutation only runs from the dialog's confirm button, and the row
 * disappears from the invalidated catalogue instead of from a local copy. The
 * dialog is shown only to a caller that may write at all — a MEMBER gets no
 * actions column — and the API stays the real guard.
 *
 * Unlike a supplier, this delete is **hard**: nothing is kept behind in the
 * table, so the description says it plainly instead of promising a soft delete.
 * The dialog stays open when the API rejects the delete, so the message that
 * explains the row is still there is not lost.
 */
export function CategoryRowActions({
	companyId,
	category,
	onEdit,
}: {
	companyId: string;
	category: Category;
	onEdit: (category: Category) => void;
}) {
	const [confirming, setConfirming] = useState(false);
	const remove = useDeleteCategory(companyId);
	const error = deleteErrorMessage(remove.error);

	return (
		<>
			<div className="flex items-center justify-end gap-2">
				<Button
					type="button"
					size="icon-lg"
					variant="ghost"
					aria-label="Editar"
					onClick={() => onEdit(category)}
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
				key={category.id}
				open={confirming}
				onOpenChange={setConfirming}
				title="Eliminar categoría"
				description={`«${category.name}» se borrará de forma definitiva. Si algún producto todavía la usa, la baja se rechaza y te vamos a decir cuántos son: cambiales la categoría primero.`}
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
									{ categoryId: category.id },
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
