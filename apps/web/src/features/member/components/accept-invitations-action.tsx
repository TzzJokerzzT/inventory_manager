"use client";

import { useState } from "react";
import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useAcceptInvitations } from "../api/use-accept-invitations";

type AcceptFeedback = "none" | "nothing-pending" | "accepted";

function acceptErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		return error.message;
	}
	return error
		? "No pudimos aceptar la invitación. Probá de nuevo."
		: undefined;
}

/**
 * "Aceptar invitación pendiente".
 *
 * `GET /me` only returns `ACTIVE` memberships, so a pending invitation is
 * invisible until it is accepted: this is the one call that can discover it.
 * The hook invalidates `["companies"]` and `["me"]` on success.
 *
 * It has two mounts, and they need different news:
 *
 * - `onboarding` (default), on `/sin-empresas`, where the invalidated company
 *   list flips the redirect: an accepted invitation needs no message, because
 *   the screen is already leaving.
 * - `panel`, on `/dashboard/user`, where the caller **already** has a company
 *   and never sees `/sin-empresas`. Nothing navigates there, so without a
 *   message the click would look like it did nothing; it says what changed and
 *   where the new company shows up.
 *
 * An empty answer is the normal "nothing pending" case, and it is said plainly
 * in both mounts. This action never navigates.
 */
export function AcceptInvitationsAction({
	variant = "onboarding",
}: {
	variant?: "onboarding" | "panel";
}) {
	const [feedback, setFeedback] = useState<AcceptFeedback>("none");
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
					setFeedback("none");
					accept.mutate(undefined, {
						onSuccess: (accepted) => {
							setFeedback(
								accepted.length === 0 ? "nothing-pending" : "accepted",
							);
						},
					});
				}}
			>
				{accept.isPending ? "Aceptando..." : "Aceptar invitación pendiente"}
			</Button>

			{feedback === "nothing-pending" ? (
				<Alert variant="warning" title="Sin invitaciones pendientes">
					No tenés invitaciones pendientes.
				</Alert>
			) : null}

			{feedback === "accepted" && variant === "panel" ? (
				<Alert variant="success" title="Invitación aceptada">
					Ya sos miembro. Vas a encontrar la empresa en el selector de empresas.
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
