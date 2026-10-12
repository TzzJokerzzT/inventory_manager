import type { Membership } from "@/lib/api/schemas";

export type MemberRole = Membership["role"];

/**
 * What the caller's role allows them to do over the roster.
 *
 * The server stays the authority: this only decides what the UI offers, so it
 * never has to explain a failure the caller could not have avoided. It is a
 * pure function on purpose — the whole authorization matrix is testable
 * without rendering a table.
 */
export type MemberPermissions = {
	canInvite: boolean;
	invitableRoles: MemberRole[];
	canChangeRole: boolean;
	canRevoke: boolean;
};

/** Roles offered for assignment, ordered from least to most privileged. */
const ALL_ROLES: MemberRole[] = ["MEMBER", "ADMIN", "OWNER"];

/**
 * The caller's own row is identified by `userId`, not by email: an `INVITED`
 * membership has no user yet and its `invitedEmail` is free text, while an
 * `ACTIVE` one always carries the resolved user id `useMe()` also exposes.
 */
export function isOwnMembership(
	membership: Membership,
	callerUserId: string,
): boolean {
	return membership.userId !== null && membership.userId === callerUserId;
}

/** Whether the caller may invite at all. A MEMBER is read-only. */
export function canInviteMembers(callerRole: MemberRole): boolean {
	return callerRole === "OWNER" || callerRole === "ADMIN";
}

/**
 * Roles the caller may hand out. An ADMIN only assigns MEMBER, mirroring the
 * "invite MEMBER only" rule; an OWNER assigns anything.
 */
export function invitableRolesFor(callerRole: MemberRole): MemberRole[] {
	if (callerRole === "OWNER") {
		return ALL_ROLES;
	}
	if (callerRole === "ADMIN") {
		return ["MEMBER"];
	}
	return [];
}

/**
 * The permissions the caller holds over one roster row.
 *
 * - MEMBER is read-only.
 * - ADMIN may invite and revoke MEMBER rows; ADMIN/OWNER rows are read-only.
 * - OWNER may do everything.
 * - Nobody changes their own role, not even an OWNER.
 * - Revoking your own row is never offered here: that is "leave the company",
 *   which has its own action and its own last-active-OWNER guard.
 */
export function selectMemberPermissions(input: {
	callerRole: MemberRole;
	callerUserId: string;
	target: Membership;
}): MemberPermissions {
	const { callerRole, callerUserId, target } = input;
	const isSelf = isOwnMembership(target, callerUserId);
	const roles = invitableRolesFor(callerRole);

	if (callerRole === "MEMBER") {
		return {
			canInvite: false,
			invitableRoles: roles,
			canChangeRole: false,
			canRevoke: false,
		};
	}

	if (callerRole === "ADMIN") {
		const actsOnMember =
			target.role === "MEMBER" && target.status !== "REVOKED";
		return {
			canInvite: true,
			invitableRoles: roles,
			// Role changes are OWNER-only: an ADMIN cannot mint a peer.
			canChangeRole: false,
			canRevoke: actsOnMember && !isSelf,
		};
	}

	return {
		canInvite: true,
		invitableRoles: roles,
		canChangeRole: !isSelf && target.status !== "REVOKED",
		canRevoke: !isSelf && target.status !== "REVOKED",
	};
}

/** ACTIVE owners currently in the roster; feeds the leave guard. */
export function countActiveOwners(memberships: Membership[]): number {
	return memberships.filter(
		(membership) =>
			membership.role === "OWNER" && membership.status === "ACTIVE",
	).length;
}

/**
 * Leaving is open to everyone except the last active OWNER, whom the server
 * would reject with `last_active_owner`. The action stays visible when the
 * server still answers 409, so the error is reported instead of hidden.
 */
export function canLeaveCompany(input: {
	callerRole: MemberRole;
	activeOwnerCount: number;
}): boolean {
	return !(input.callerRole === "OWNER" && input.activeOwnerCount <= 1);
}
