"use client";

import { cn } from "cn";
import { type Column, DataTable } from "@/components/design-system";
import type { Membership } from "@/lib/api/schemas";
import { MEMBERSHIP_STATUS_LABELS, ROLE_LABELS } from "@/src/utils/constants";
import {
	type MemberRole,
	selectMemberPermissions,
} from "../lib/member-permissions";
import { MemberRowActions } from "./member-row-actions";

const STATUS_STYLES: Record<string, string> = {
	ACTIVE: "bg-success-soft text-success-text",
	INVITED: "bg-warning-soft text-warning-text",
};

function StatusBadge({ status }: { status: Membership["status"] }) {
	return (
		<span
			className={cn(
				"inline-flex rounded-full px-3 py-1 text-xs",
				STATUS_STYLES[status] ?? "bg-surface-muted text-text-muted",
			)}
		>
			{MEMBERSHIP_STATUS_LABELS[status] ?? status}
		</span>
	);
}

/**
 * The roster of the active company.
 *
 * Columns are email, role, status and actions. There are no display names yet
 * — the API does not join `users` — so `invitedEmail` is the only identifier
 * and nothing is invented to fill the gap. Every action comes from the same
 * permission selector, so what the row shows and what it may do cannot drift.
 */
export function MemberRosterTable({
	companyId,
	members,
	callerRole,
	callerUserId,
}: {
	companyId: string;
	members: Membership[];
	callerRole: MemberRole;
	callerUserId: string;
}) {
	const columns: Column<Membership>[] = [
		{
			key: "invitedEmail",
			header: "Correo electrónico",
			render: (membership) => membership.invitedEmail,
		},
		{
			key: "role",
			header: "Rol",
			render: (membership) => ROLE_LABELS[membership.role] ?? membership.role,
		},
		{
			key: "status",
			header: "Estado",
			render: (membership) => <StatusBadge status={membership.status} />,
		},
		{
			key: "actions",
			header: "Acciones",
			align: "right",
			render: (membership) => (
				<MemberRowActions
					companyId={companyId}
					membership={membership}
					permissions={selectMemberPermissions({
						callerRole,
						callerUserId,
						target: membership,
					})}
				/>
			),
		},
	];

	return (
		<DataTable
			columns={columns}
			rows={members}
			getRowKey={(membership) => membership.id}
			emptyMessage="Todavía no hay miembros en esta empresa."
		/>
	);
}
