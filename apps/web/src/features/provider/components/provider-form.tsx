"use client";

import { type FormEvent, useRef, useState } from "react";
import { Alert, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { Supplier } from "@/lib/api/schemas";
import { useCreateProvider } from "../api/use-create-provider";
import { useUpdateProvider } from "../api/use-update-provider";
import {
	normalizeProviderName,
	toNullableProviderContact,
	validateProvider,
} from "../lib/validate-provider";

const FALLBACK_ERROR = "No pudimos guardar el proveedor. Probá de nuevo.";

/**
 * Turns the API failure into something a person can act on.
 *
 * The API's own message is the right copy for every code it sends — a duplicate
 * name (`409 supplier_name_already_exists`) and a missing role
 * (`403 insufficient_role`) both arrive already explained by the server — with
 * one exception: `supplier_not_found`, whose contract text is a developer
 * message, so it is translated here into what happened to the person editing.
 */
function saveErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		if (error.code === "supplier_not_found") {
			return "Ese proveedor ya no existe en esta empresa.";
		}
		return error.message;
	}
	return error ? FALLBACK_ERROR : undefined;
}

/**
 * The supplier form, in create and edit mode.
 *
 * One component for both because the fields, the validation and the layout are
 * the same: what changes is the supplier it starts from and the mutation it
 * calls. A supplier passed in means edit; nothing means create.
 *
 * Editing starts from the **row the roster already has**: the contract has no
 * per-supplier read, so there is nothing to fetch and nothing that could be
 * stale in a second copy. It lives inside the list page — there is no route for
 * it — so both outcomes (saved or cancelled) are reported through `onSaved` /
 * `onCancel`.
 *
 * Validation mirrors the API (name 1..120; contact optional, ≤120), so an
 * invalid body never reaches the server. The values are normalized before
 * sending — trimmed name, `null` for a blank contact — because that is the
 * shape the contract stores.
 */
export function ProviderForm({
	companyId,
	provider,
	onSaved,
	onCancel,
}: {
	companyId: string;
	provider?: Supplier;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const isEdit = provider !== undefined;

	const [name, setName] = useState(provider?.name ?? "");
	const [contact, setContact] = useState(provider?.contact ?? "");
	const [attempted, setAttempted] = useState(false);
	const nameRef = useRef<HTMLInputElement>(null);

	const create = useCreateProvider(companyId);
	const update = useUpdateProvider(companyId);

	const isPending = create.isPending || update.isPending;
	const errors = attempted ? validateProvider({ name, contact }) : {};
	const saveError = saveErrorMessage(create.error ?? update.error);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setAttempted(true);

		const nextErrors = validateProvider({ name, contact });
		if (Object.keys(nextErrors).length > 0) {
			nameRef.current?.focus();
			return;
		}

		const body = {
			name: normalizeProviderName(name),
			contact: toNullableProviderContact(contact),
		};

		if (provider) {
			update.mutate(
				{ supplierId: provider.id, ...body },
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
			data-slot="provider-form"
			aria-label={isEdit ? "Editar proveedor" : "Crear proveedor"}
			className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
		>
			<TextField
				ref={nameRef}
				label="Nombre del proveedor"
				name="name"
				placeholder="Plásticos del Sur"
				autoComplete="off"
				className="sm:col-span-2"
				value={name}
				onChange={(event) => setName(event.target.value)}
				error={errors.name}
				disabled={isPending}
			/>
			<TextField
				label="Contacto"
				name="contact"
				placeholder="Ana Gómez · +54 11 4321-9876"
				autoComplete="off"
				className="sm:col-span-2"
				value={contact}
				onChange={(event) => setContact(event.target.value)}
				error={errors.contact}
				hint="Opcional. Persona, teléfono o email."
				disabled={isPending}
			/>

			{saveError ? (
				<div className="sm:col-span-full">
					<Alert variant="danger" title="No pudimos guardar el proveedor">
						{saveError}
					</Alert>
				</div>
			) : null}

			<div className="col-span-full flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
				<Button
					type="button"
					variant="outline"
					className="h-10 w-full sm:w-30"
					onClick={onCancel}
				>
					Cancelar
				</Button>
				<Button
					className="h-10 w-full sm:w-30"
					type="submit"
					disabled={isPending}
				>
					{isPending ? (
						<>
							<SpinnerMotion size={16} className="mr-2" />
							{isEdit ? "Guardando..." : "Creando..."}
						</>
					) : isEdit ? (
						"Guardar cambios"
					) : (
						"Crear proveedor"
					)}
				</Button>
			</div>
		</form>
	);
}
