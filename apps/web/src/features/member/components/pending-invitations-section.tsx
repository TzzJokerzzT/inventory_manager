"use client";

import type { PendingInvitation } from "@/lib/api/schemas";
import { formatDate } from "@/src/features/dashboard/mock";
import { ROLE_LABELS } from "@/src/utils/constants";
import { usePendingInvitations } from "../api/use-pending-invitations";
import { AcceptInvitationsAction } from "./accept-invitations-action";

/**
 * Pending invitations, mounted in the profile panel.
 *
 * It renders nothing until there is at least one pending invitation: the read
 * is additive context, an empty list is the normal case, and the profile must
 * not be padded with a section that says nothing. The section replaces the
 * blind accept button, so the invitee sees what is being offered and by whom
 * before accepting.
 */
export function PendingInvitationsSection() {
	const invitations = usePendingInvitations();
	const pending = invitations.data ?? [];

	if (pending.length === 0) {
		return null;
	}

	return (
		<section
			aria-labelledby="pending-invitations-heading"
			className="flex flex-col gap-3"
		>
			<div className="flex flex-col gap-1">
				<h2
					id="pending-invitations-heading"
					className="text-lg font-semibold text-text-primary"
				>
					Invitaciones pendientes
				</h2>
				<p className="text-sm text-text-secondary">
					Si te invitaron a otra empresa, aceptá la invitación desde acá. Vas a
					poder cambiarte a ella con el selector de empresas.
				</p>
			</div>

			<ul className="flex flex-col gap-2">
				{pending.map((invitation) => (
					<li
						key={invitation.membershipId}
						className="flex flex-col gap-1 rounded-md border border-border px-4 py-3"
					>
						<span className="text-base text-text-primary">
							{invitation.company.name}
						</span>
						<span className="text-sm text-text-secondary">
							Rol ofrecido: {ROLE_LABELS[invitation.role] ?? invitation.role}
						</span>
						<span className="text-xs text-text-muted">
							Enviada el {formatDate(invitation.invitedAt)}
						</span>
						<span className="text-sm text-text-secondary">
							Invitación de {inviterLabel(invitation.inviter)}
						</span>
					</li>
				))}
			</ul>

			{/*
			 * The action still accepts every pending invitation; the section is
			 * what removed the guesswork about whether there is one.
			 */}
			<AcceptInvitationsAction variant="panel" />
		</section>
	);
}

/**
 * A missing inviter must never hide the invitation, so the label degrades from
 * the name to the email to a neutral company label instead of rendering an
 * empty row.
 */
function inviterLabel(inviter: PendingInvitation["inviter"]): string {
	if (inviter === null) {
		return "un administrador de la empresa";
	}

	return inviter.fullName ?? inviter.email;
}
