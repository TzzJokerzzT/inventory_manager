"use client";

import { useState } from "react";
import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useAcceptInvitations } from "../api/use-accept-invitations";

function acceptErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		return error.message;
	}
	return error
		? "No pudimos aceptar la invitación. Probá de nuevo."
		: undefined;
}

/**
 * "Aceptar invitación pendiente" for the no-companies state.
 *
 * `GET /me` only returns `ACTIVE` memberships, so a pending invitation is
 * invisible until it is accepted: this is the one call that can discover it.
 * The hook invalidates `["companies"]` and `["me"]` on success, and the
 * `/sin-empresas` redirect takes over from there — this action never navigates.
 * An empty answer is the normal "nothing pending" case and is said plainly.
 */
export function AcceptInvitationsAction() {
	const [nothingPending, setNothingPending] = useState(false);
	const accept = useAcceptInvitations();
	const error = acceptErrorMessage(accept.error);

	return (
		<div className="flex flex-col gap-3">
			<Button
				size="ds"
				variant="secondary"
				type="button"
				className="w-full"
				disabled={accept.isPending}
				onClick={() => {
					setNothingPending(false);
					accept.mutate(undefined, {
						onSuccess: (accepted) => {
							// A non-empty answer means the invalidated `["companies"]`
							// refetch will land the user on the dashboard; an empty one
							// has no destination, so it gets a message instead.
							setNothingPending(accepted.length === 0);
						},
					});
				}}
			>
				{accept.isPending ? "Aceptando..." : "Aceptar invitación pendiente"}
			</Button>

			{nothingPending ? (
				<Alert variant="warning" title="Sin invitaciones pendientes">
					No tenés invitaciones pendientes.
				</Alert>
			) : null}

			{error ? (
				<Alert variant="danger" title="No pudimos aceptar la invitación">
					{error}
				</Alert>
			) : null}
		</div>
	);
}
