"use client";

import { type FormEvent, useRef, useState } from "react";
import { Alert, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/schemas";
import { useCreateCategory } from "../api/use-create-category";
import { useUpdateCategory } from "../api/use-update-category";
import {
	normalizeCategoryName,
	validateCategory,
} from "../lib/validate-category";

const FALLBACK_ERROR = "No pudimos guardar la categoría. Probá de nuevo.";

/**
 * Turns the API failure into something a person can act on.
 *
 * Unlike the supplier form, the conflict is **not** re-worded here: `409
 * category_name_already_exists` is shown exactly as the API sent it, because the
 * contract owns that sentence and the UI must not swallow it (S6). The one code
 * that states a developer fact — `category_not_found`, what a category deleted
 * from another tab produces — is translated, since the server's wording adds
 * nothing a person could act on.
 */
function saveErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		if (error.code === "category_not_found") {
			return "Esa categoría ya no existe en esta empresa.";
		}
		return error.message;
	}
	return error ? FALLBACK_ERROR : undefined;
}

/**
 * The category form, in create and edit mode.
 *
 * One component for both because the field, the validation and the layout are
 * the same: what changes is the category it starts from and the mutation it
 * calls. A category passed in means edit; nothing means create.
 *
 * Editing starts from the **row the catalogue already has**: the contract has no
 * per-category read, so there is nothing to fetch and nothing that could be
 * stale in a second copy. Both outcomes (saved or cancelled) are reported
 * through `onSaved` / `onCancel`, which is what sends the person back to the
 * list.
 *
 * Validation mirrors the API (name 1..120 after trim), so an invalid body never
 * reaches the server. The name is normalized before sending — trimmed — because
 * that is the shape the contract stores.
 */
export function CategoryForm({
	companyId,
	category,
	onSaved,
	onCancel,
}: {
	companyId: string;
	category?: Category;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const isEdit = category !== undefined;

	const [name, setName] = useState(category?.name ?? "");
	const [attempted, setAttempted] = useState(false);
	const nameRef = useRef<HTMLInputElement>(null);

	const create = useCreateCategory(companyId);
	const update = useUpdateCategory(companyId);

	const isPending = create.isPending || update.isPending;
	const errors = attempted ? validateCategory({ name }) : {};
	const saveError = saveErrorMessage(create.error ?? update.error);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setAttempted(true);

		const nextErrors = validateCategory({ name });
		if (Object.keys(nextErrors).length > 0) {
			nameRef.current?.focus();
			return;
		}

		const body = { name: normalizeCategoryName(name) };

		if (category) {
			update.mutate(
				{ categoryId: category.id, ...body },
				{ onSuccess: onSaved },
			);
			return;
		}

		create.mutate(body, { onSuccess: onSaved });
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			data-slot="category-form"
			aria-label={isEdit ? "Editar categoría" : "Crear categoría"}
			className="grid w-full min-w-0 grid-cols-1 gap-4"
		>
			<TextField
				ref={nameRef}
				label="Nombre de la categoría"
				name="name"
				placeholder="Bebidas"
				autoComplete="off"
				value={name}
				onChange={(event) => setName(event.target.value)}
				error={errors.name}
				hint="Así se va a ver en el formulario de producto."
				disabled={isPending}
			/>

			{saveError ? (
				<Alert variant="danger" title="No pudimos guardar la categoría">
					{saveError}
				</Alert>
			) : null}

			<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
				<Button
					type="button"
					variant="outline"
					className="h-10 w-full sm:w-30"
					onClick={onCancel}
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
							<SpinnerMotion size={20} className="mr-2" />
							{isEdit ? "Guardando..." : "Creando..."}
						</>
					) : isEdit ? (
						"Guardar cambios"
					) : (
						"Crear categoría"
					)}
				</Button>
			</div>
		</form>
	);
}
