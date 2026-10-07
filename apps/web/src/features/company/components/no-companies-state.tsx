"use client";

import { type FormEvent, useState } from "react";
import { Alert, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useCreateCompany } from "../api/use-create-company";

const FALLBACK_ERROR = "No pudimos crear tu empresa. Probá de nuevo.";

/**
 * The "no companies" bootstrap state, derived from the dashboard's visual
 * language: a centered card offering "crear mi empresa" and, as the
 * alternative, waiting for an assignment.
 *
 * Only the state is in scope here — the dashboard view (MI-20) owns the fine
 * visual polish, so this uses the design system's card/surface tokens without
 * reproducing the whole shell.
 */
export function NoCompaniesState() {
	const [name, setName] = useState("");
	const createCompany = useCreateCompany();
	const busy = createCompany.isPending;
	const apiError =
		createCompany.error instanceof ApiError
			? createCompany.error.message
			: createCompany.isError
				? FALLBACK_ERROR
				: undefined;
	const canSubmit = name.trim() !== "" && !busy;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (name.trim() === "") {
			return;
		}
		createCompany.mutate({ name: name.trim() });
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
			<section className="flex w-full max-w-md flex-col gap-6 rounded-md border border-border bg-surface p-8">
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-bold text-text-primary">
						Todavía no tenés una empresa
					</h1>
					<p className="text-base text-text-secondary">
						Creá tu empresa para empezar a gestionar tu inventario, o esperá a
						que te asignen una.
					</p>
				</div>

				<form
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
					<Button
						size="ds"
						variant="primary"
						type="submit"
						className="w-full"
						disabled={!canSubmit}
					>
						{busy ? "Creando..." : "Crear mi empresa"}
					</Button>
				</form>

				{apiError ? (
					<Alert variant="danger" title="No pudimos crear tu empresa">
						{apiError}
					</Alert>
				) : null}

				<p className="text-sm text-text-muted">
					Si alguien te asigna a una empresa, la vas a ver acá.
				</p>
			</section>
		</main>
	);
}
