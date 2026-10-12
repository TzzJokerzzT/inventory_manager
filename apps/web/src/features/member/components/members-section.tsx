"use client";

import { SpinnerMotion } from "@/components/ui/spinner";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useMe } from "@/src/features/user/api/use-me";
import { ErrorMessage } from "@/src/shared/components/ErrorMessage";
import { useMembers } from "../api/use-members";
import {
	canInviteMembers,
	canLeaveCompany,
	countActiveOwners,
	invitableRolesFor,
	type MemberRole,
} from "../lib/member-permissions";
import { InviteMemberForm } from "./invite-member-form";
import { LeaveCompanyAction } from "./leave-company-action";
import { MemberRosterTable } from "./member-roster-table";

/**
 * Company members section, mounted inside `/dashboard/user`.
 *
 * It works on the **active company** only: `useActiveCompany()` picks it, and
 * `useMe()`'s memberships supply the caller's role for that company, which is
 * what the permission selector turns into the row actions. There is no route
 * and no nav entry of its own — it is a section of the profile page.
 */
export function MembersSection() {
	const activeCompany = useActiveCompany();
	const { data: me } = useMe();
	const companyId = activeCompany?.id;
	const members = useMembers(companyId);

	const callerMembership = me?.memberships.find(
		(membership) => membership.companyId === companyId,
	);
	// No membership in the active company means read-only: the roster would be
	// forbidden server-side, so no action is offered until `/me` proves one.
	const callerRole: MemberRole = callerMembership?.role ?? "MEMBER";
	const callerUserId = me?.id ?? "";
	const roster = members.data ?? [];
	const canLeave =
		callerMembership !== undefined &&
		canLeaveCompany({
			callerRole,
			activeOwnerCount: countActiveOwners(roster),
		});

	return (
		<section aria-labelledby="members-heading" className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<h2
					id="members-heading"
					className="text-lg font-semibold text-text-primary"
				>
					Miembros de la empresa
				</h2>
				<p className="text-sm text-text-secondary">
					Gestioná quién pertenece a{" "}
					{activeCompany?.name ?? "la empresa activa"}.
				</p>
			</div>

			{companyId === undefined ? (
				<p className="text-sm text-text-muted">
					Seleccioná una empresa para ver sus miembros.
				</p>
			) : members.isPending ? (
				<div className="flex justify-center py-6">
					<SpinnerMotion size={28} />
				</div>
			) : members.isError ? (
				<ErrorMessage
					message="No pudimos cargar los miembros de la empresa."
					action={members.refetch}
					btnMessage="Reintentar"
				/>
			) : (
				<>
					{canInviteMembers(callerRole) ? (
						<InviteMemberForm
							companyId={companyId}
							invitableRoles={invitableRolesFor(callerRole)}
						/>
					) : null}

					<MemberRosterTable
						companyId={companyId}
						members={roster}
						callerRole={callerRole}
						callerUserId={callerUserId}
					/>

					<LeaveCompanyAction companyId={companyId} disabled={!canLeave} />
				</>
			)}
		</section>
	);
}
