"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import type { Membership } from "@/lib/api/schemas";
import { ROLE_LABELS } from "@/src/utils/constants";
import { useChangeMemberRole } from "../api/use-change-member-role";
import { useRevokeMember } from "../api/use-revoke-member";
import type { MemberPermissions, MemberRole } from "../lib/member-permissions";
import { isMemberRole } from "../lib/validate-invite";

const ROLE_FALLBACK = "No pudimos cambiar el rol.";
const REVOKE_FALLBACK = "No pudimos quitar a esta persona.";

/** Maps the API `code` to a readable message; unknown codes keep the server's. */
function actionError(error: unknown, fallback: string): string | undefined {
	if (error instanceof ApiError) {
		if (error.code === "last_active_owner") {
			return "No se puede quitar al último propietario activo.";
		}
		if (error.code === "insufficient_role") {
			return "Tu rol no permite esta acción.";
		}
		if (error.code === "membership_not_found") {
			return "Esa membresía ya no existe.";
		}
		return error.message;
	}
	return error ? fallback : undefined;
}

function ErrorText({ message }: { message: string }) {
	return (
		<p role="alert" className="mt-1 text-xs text-danger-text">
			{message}
		</p>
	);
}

/**
 * Per-row role change, gated behind an explicit confirmation.
 *
 * The control only mounts when the permission selector allowed it; the
 * mutation still invalidates the roster on success, so the row re-renders from
 * the server's state instead of a local copy that a rejection could leave
 * stale.
 */
function ChangeRoleAction({
	companyId,
	membership,
	invitableRoles,
}: {
	companyId: string;
	membership: Membership;
	invitableRoles: MemberRole[];
}) {
	const [editing, setEditing] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [role, setRole] = useState<MemberRole>(membership.role);
	const changeRole = useChangeMemberRole(companyId);
	const error = actionError(changeRole.error, ROLE_FALLBACK);

	if (!editing) {
		return (
			<Button
				type="button"
				size="sm"
				variant="ghost"
				onClick={() => setEditing(true)}
			>
				Cambiar rol
			</Button>
		);
	}

	if (confirming) {
		return (
			<div className="flex flex-col items-end gap-1">
				<div className="flex items-center gap-2">
					<span className="text-xs text-text-secondary">
						¿Cambiar a {ROLE_LABELS[role] ?? role}?
					</span>
					<Button
						type="button"
						size="xs"
						variant="primary"
						disabled={changeRole.isPending}
						onClick={() => {
							changeRole.mutate(
								{ membershipId: membership.id, role },
								{ onSuccess: () => setEditing(false) },
							);
						}}
					>
						Sí, cambiar
					</Button>
					<Button
						type="button"
						size="xs"
						variant="ghost"
						onClick={() => setConfirming(false)}
					>
						Cancelar
					</Button>
				</div>
				{error ? <ErrorText message={error} /> : null}
			</div>
		);
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<div className="flex items-center gap-2">
				<select
					aria-label={`Rol de ${membership.invitedEmail}`}
					className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-text-primary focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
					value={role}
					onChange={(event) => {
						if (isMemberRole(event.target.value)) {
							setRole(event.target.value);
						}
					}}
				>
					{invitableRoles.map((value) => (
						<option key={value} value={value}>
							{ROLE_LABELS[value] ?? value}
						</option>
					))}
				</select>
				<Button
					type="button"
					size="xs"
					variant="outline"
					disabled={role === membership.role}
					onClick={() => setConfirming(true)}
				>
					Guardar rol
				</Button>
				<Button
					type="button"
					size="xs"
					variant="ghost"
					onClick={() => {
						setEditing(false);
						setRole(membership.role);
					}}
				>
					Cancelar
				</Button>
			</div>
			{error ? <ErrorText message={error} /> : null}
		</div>
	);
}

/**
 * Per-row revoke, gated behind an explicit confirmation.
 *
 * Revoking the caller's own row is never offered: the permission selector
 * already excluded it, because that is "leave the company" with a different
 * endpoint and its own last-active-OWNER guard.
 */
function RevokeAction({
	companyId,
	membership,
}: {
	companyId: string;
	membership: Membership;
}) {
	const [confirming, setConfirming] = useState(false);
	const revoke = useRevokeMember(companyId);
	const error = actionError(revoke.error, REVOKE_FALLBACK);

	if (!confirming) {
		return (
			<Button
				type="button"
				size="sm"
				variant="ghost"
				className="text-danger-text hover:bg-danger-soft"
				onClick={() => setConfirming(true)}
			>
				Quitar
			</Button>
		);
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<div className="flex items-center gap-2">
				<Button
					type="button"
					size="xs"
					variant="danger"
					disabled={revoke.isPending}
					onClick={() => revoke.mutate({ membershipId: membership.id })}
				>
					Sí, quitar
				</Button>
				<Button
					type="button"
					size="xs"
					variant="ghost"
					onClick={() => setConfirming(false)}
				>
					Cancelar
				</Button>
			</div>
			{error ? <ErrorText message={error} /> : null}
		</div>
	);
}

/** The actions column: role change and revoke, each behind its confirmation. */
export function MemberRowActions({
	companyId,
	membership,
	permissions,
}: {
	companyId: string;
	membership: Membership;
	permissions: MemberPermissions;
}) {
	if (!permissions.canChangeRole && !permissions.canRevoke) {
		return <span className="text-text-muted">—</span>;
	}

	return (
		<div className="flex flex-wrap items-start justify-end gap-2">
			{permissions.canChangeRole ? (
				<ChangeRoleAction
					companyId={companyId}
					membership={membership}
					invitableRoles={permissions.invitableRoles}
				/>
			) : null}
			{permissions.canRevoke ? (
				<RevokeAction companyId={companyId} membership={membership} />
			) : null}
		</div>
	);
}
