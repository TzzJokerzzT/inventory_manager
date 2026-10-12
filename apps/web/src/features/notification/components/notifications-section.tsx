"use client";

import { cn } from "cn";
import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import type { MeNotification } from "@/lib/api/schemas";
import { formatDate } from "@/src/utils/formatDate";
import { useMarkNotificationsRead } from "../api/use-mark-notifications-read";
import { useNotifications } from "../api/use-notifications";

function markReadErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		return error.message;
	}
	return error
		? "No pudimos marcar las notificaciones. Probá de nuevo."
		: undefined;
}

/**
 * The caller's notifications, mounted in the profile panel.
 *
 * It renders nothing until there is at least one notification: an empty list
 * is the normal case and the profile must not be padded with a section that
 * says nothing. Unread means `readAt === null`, and the single action marks the
 * whole list as read.
 *
 * Copy is resolved by `type` so an event says what happened in Spanish. The
 * contract allows new event kinds later, so an unknown type degrades to a
 * neutral sentence instead of rendering `undefined`.
 */
export function NotificationsSection() {
	const notifications = useNotifications();
	const markRead = useMarkNotificationsRead();
	const list = notifications.data ?? [];
	const hasUnread = list.some((notification) => notification.readAt === null);
	const error = markReadErrorMessage(markRead.error);

	if (list.length === 0) {
		return null;
	}

	return (
		<section
			aria-labelledby="notifications-heading"
			className="flex w-full max-w-4xl flex-col gap-3 rounded-md border border-border bg-surface p-8"
		>
			<div className="flex flex-col gap-1">
				<h2
					id="notifications-heading"
					className="text-lg font-semibold text-text-primary"
				>
					Notificaciones
				</h2>
				<p className="text-sm text-text-secondary">
					Novedades de las empresas a las que pertenecés.
				</p>
			</div>

			<ul className="flex flex-col gap-2">
				{list.map((notification) => {
					const unread = notification.readAt === null;

					return (
						<li
							key={notification.id}
							className={cn(
								"flex flex-col gap-1 rounded-md border px-4 py-3",
								// The unread row carries the highlight; the exact same
								// copy for a read row stays quiet.
								unread ? "border-primary/40 bg-primary/5" : "border-border",
							)}
						>
							<span className="text-sm text-text-primary">
								{notificationMessage(notification)}
							</span>
							<span className="text-xs text-text-muted">
								{formatDate(notification.createdAt)}
							</span>
							{unread ? (
								<span className="text-xs font-medium text-primary">Nueva</span>
							) : null}
						</li>
					);
				})}
			</ul>

			{/*
			 * One action for the whole list, and it only appears while there is
			 * something to mark: a button that would do nothing is noise.
			 */}
			{hasUnread ? (
				<Button
					size="ds"
					variant="secondary"
					type="button"
					className="w-full"
					disabled={markRead.isPending}
					onClick={() => markRead.mutate()}
				>
					{markRead.isPending ? "Marcando..." : "Marcar todas como leídas"}
				</Button>
			) : null}

			{error ? (
				<Alert variant="danger" title="No pudimos marcar las notificaciones">
					{error}
				</Alert>
			) : null}
		</section>
	);
}

/**
 * Resolves the event kind to a sentence. `membership.accepted` is the only
 * kind the backend emits today; anything else — a future kind the client does
 * not know yet — falls back to neutral copy that still names the company when
 * it resolved, because the event must never be hidden for a missing sentence.
 *
 * The actor is named when the read resolved them, degrading from full name to
 * email to the neutral "Alguien": the event is the fact, the attribution is
 * context.
 */
function notificationMessage(notification: MeNotification): string {
	const company = notification.company?.name;
	const actor = actorLabel(notification.actor);

	switch (notification.type) {
		case "membership.accepted":
			if (actor && company) {
				return `${actor} aceptó tu invitación a ${company}.`;
			}
			if (actor) {
				return `${actor} aceptó tu invitación.`;
			}
			return company
				? `Alguien aceptó tu invitación a ${company}.`
				: "Alguien aceptó tu invitación.";
		default:
			return company
				? `Tenés una novedad en ${company}.`
				: "Tenés una novedad.";
	}
}

/**
 * The actor's display label: their full name, then their email, then `null` so
 * the caller falls back to the neutral "Alguien". A blank name or email counts
 * as absent instead of rendering as whitespace.
 */
function actorLabel(actor: MeNotification["actor"]): string | null {
	if (actor === null) {
		return null;
	}

	const fullName = actor.fullName?.trim();
	if (fullName) {
		return fullName;
	}

	const email = actor.email.trim();
	return email !== "" ? email : null;
}
