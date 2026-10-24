"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert, Modal, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useCreateCompany } from "../api/use-create-company";

/** Shown when the API answered without a message we can surface. */
const FALLBACK_ERROR = "No pudimos crear la empresa. Probá de nuevo.";

const FORM_ID = "create-company-form";

export interface CreateCompanyModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Creates an additional company from inside the app.
 *
 * It is the same operation the `sin-empresas` screen offers for the first one
 * (`POST /companies`); the difference is the entry point, not the contract.
 * `useCreateCompany` already owns the consequences: the API mints the caller as
 * `OWNER`, the created company becomes the active one and the list is
 * invalidated.
 *
 * On success it lands on the dashboard: the company context just changed under
 * the current route, and showing the new (empty) inventory is more honest than
 * leaving the person on a page whose data now belongs to another company.
 */
export function CreateCompanyModal({
	open,
	onOpenChange,
}: CreateCompanyModalProps) {
	const router = useRouter();
	const createCompany = useCreateCompany();
	const [name, setName] = useState("");

	const trimmedName = name.trim();
	const busy = createCompany.isPending;
	const canSubmit = trimmedName.length > 0 && !busy;
	const failure = createCompany.error;

	const errorMessage =
		failure instanceof ApiError
			? failure.message
			: failure
				? FALLBACK_ERROR
				: undefined;

	function close(): void {
		setName("");
		onOpenChange(false);
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		if (!canSubmit) {
			return;
		}

		createCompany.mutate(
			{ name: trimmedName },
			{
				onSuccess: () => {
					close();
					router.push("/dashboard");
				},
			},
		);
	}

	return (
		<Modal
			open={open}
			onOpenChange={(next) => (next ? onOpenChange(true) : close())}
			title="Crear empresa"
			description="Quedás como dueño de la empresa nueva y se activa en el acto: tus productos, clientes y movimientos quedan separados de las demás."
			footer={
				<>
					<Button type="button" size="sm" variant="ghost" onClick={close}>
						Cancelar
					</Button>
					<Button
						type="submit"
						size="sm"
						variant="primary"
						form={FORM_ID}
						disabled={!canSubmit}
					>
						{busy ? "Creando..." : "Crear empresa"}
					</Button>
				</>
			}
		>
			<form
				id={FORM_ID}
				onSubmit={handleSubmit}
				className="flex flex-col gap-4"
				noValidate
			>
				<TextField
					label="Nombre de la empresa"
					name="companyName"
					placeholder="Empresa comercializadora S.A.S"
					autoComplete="organization"
					value={name}
					onChange={(event) => setName(event.target.value)}
					disabled={busy}
				/>
			</form>

			{errorMessage ? (
				<div className="mt-4">
					<Alert variant="danger" title="No pudimos crear la empresa">
						{errorMessage}
					</Alert>
				</div>
			) : null}
		</Modal>
	);
}
