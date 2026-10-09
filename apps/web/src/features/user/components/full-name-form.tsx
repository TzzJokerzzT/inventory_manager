"use client";

import { type FormEvent, useRef, useState } from "react";
import { Alert, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useUpdateFullName } from "../api/use-update-full-name";
import { validateFullName } from "../lib/validate-full-name";

const FALLBACK_ERROR = "No pudimos guardar tu nombre. Probá de nuevo.";

/**
 * The `fullName` form shared by the profile page and the `/sin-empresas` gate.
 *
 * It owns its state only for what is being typed: the saved name lives in the
 * `["me"]` query, which `useUpdateFullName` invalidates on success. The
 * validation mirrors the server (non-empty after trimming, at most 120
 * characters) so an invalid value never reaches the API, and it never sends an
 * empty name — clearing it exists in the API but is not offered here.
 */
export function FullNameForm() {
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	// `submitted` only decides when validation errors show; `isPending` alone
	// decides when the fields lock, so a finished request never leaves the
	// form disabled for good.
	const [submitted, setSubmitted] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const update = useUpdateFullName();
	const busy = update.isPending;
	const apiError =
		update.error instanceof ApiError
			? update.error.message
			: update.isError
				? FALLBACK_ERROR
				: undefined;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const nextError = validateFullName(name);

		if (nextError) {
			setError(nextError);
			setSubmitted(true);
			inputRef.current?.focus();
			return;
		}

		setError(null);
		setSubmitted(true);
		update.mutate({ fullName: name.trim() });
	}

	function handleChange(value: string) {
		setName(value);
		// Only react to corrections after a submit attempt, so nothing shows
		// while the user is still filling the form for the first time.
		if (submitted) {
			setError(validateFullName(value));
		}
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			className="flex flex-col gap-4"
			data-slot="full-name-form"
		>
			<TextField
				ref={inputRef}
				label="Nombre completo"
				name="fullName"
				placeholder="Ana Pérez"
				autoComplete="name"
				value={name}
				onChange={(event) => handleChange(event.target.value)}
				error={error ?? undefined}
				disabled={busy}
			/>
			<Button
				size="ds"
				variant="primary"
				type="submit"
				className="w-full"
				disabled={busy}
			>
				{busy ? "Guardando..." : "Guardar nombre"}
			</Button>

			{apiError ? (
				<Alert variant="danger" title="No pudimos guardar tu nombre">
					{apiError}
				</Alert>
			) : null}
		</form>
	);
}
