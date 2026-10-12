"use client";

import { type FormEvent, useRef, useState } from "react";
import { Alert, SelectField, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { ROLE_LABELS } from "@/src/utils/constants";
import { useInviteMember } from "../api/use-invite-member";
import type { MemberRole } from "../lib/member-permissions";
import { isMemberRole, validateInviteEmail } from "../lib/validate-invite";

const FALLBACK_ERROR = "No pudimos enviar la invitación. Probá de nuevo.";

/**
 * Turns the API's machine-readable `code` into something a person can act on.
 * A code we do not know falls back to the server's message, which is already
 * user-facing.
 */
function inviteErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		if (error.code === "membership_already_exists") {
			return "Ese correo ya pertenece a la empresa o tiene una invitación pendiente.";
		}
		if (error.code === "insufficient_role") {
			return "Tu rol no permite invitar con ese rol.";
		}
		return error.message;
	}
	return error ? FALLBACK_ERROR : undefined;
}

/**
 * Invite form (email + role) for the roster card.
 *
 * It is only mounted when the caller's role can invite, and the role options
 * come from the same permission selector the table uses, so the form can never
 * offer a role the caller cannot hand out. Validation runs before the request;
 * the API stays the authority for everything else.
 */
export function InviteMemberForm({
	companyId,
	invitableRoles,
}: {
	companyId: string;
	invitableRoles: MemberRole[];
}) {
	const defaultRole = invitableRoles[0] ?? "MEMBER";
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<MemberRole>(defaultRole);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const invite = useInviteMember(companyId);
	const { isPending, mutate } = invite;
	const apiError = inviteErrorMessage(invite.error);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const nextError = validateInviteEmail(email);
		if (nextError) {
			setError(nextError);
			inputRef.current?.focus();
			return;
		}

		setError(null);
		mutate(
			{ email: email.trim(), role },
			{
				onSuccess: () => {
					setEmail("");
					setRole(defaultRole);
				},
			},
		);
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			data-slot="invite-member-form"
			className="flex flex-col gap-4 rounded-md border border-border bg-surface-muted p-4"
		>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
				<TextField
					ref={inputRef}
					label="Correo electrónico"
					name="inviteEmail"
					type="email"
					placeholder="persona@empresa.com"
					autoComplete="email"
					value={email}
					onChange={(event) => {
						setEmail(event.target.value);
						if (error) {
							setError(null);
						}
					}}
					error={error ?? undefined}
					disabled={isPending}
				/>
				<SelectField
					label="Rol"
					name="inviteRole"
					value={role}
					onChange={(event) => {
						if (isMemberRole(event.target.value)) {
							setRole(event.target.value);
						}
					}}
					options={invitableRoles.map((value) => ({
						value,
						label: ROLE_LABELS[value] ?? value,
					}))}
					disabled={isPending}
				/>
				<Button
					size="ds"
					variant="primary"
					type="submit"
					disabled={isPending}
					className="w-full sm:w-auto"
				>
					{isPending ? "Invitando..." : "Invitar"}
				</Button>
			</div>

			{apiError ? (
				<Alert variant="danger" title="No pudimos enviar la invitación">
					{apiError}
				</Alert>
			) : null}
		</form>
	);
}
