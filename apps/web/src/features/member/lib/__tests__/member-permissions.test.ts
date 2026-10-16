import type { Membership } from "@/lib/api/schemas";
import {
	canInviteMembers,
	canLeaveCompany,
	countActiveOwners,
	invitableRolesFor,
	isOwnMembership,
	type MemberRole,
	selectMemberPermissions,
} from "../member-permissions";

const CALLER_ID = "user-1";

function membership(overrides: Partial<Membership> = {}): Membership {
	return {
		id: "m1",
		userId: "user-2",
		invitedEmail: "otro@empresa.com",
		companyId: "c1",
		role: "MEMBER",
		status: "ACTIVE",
		invitedBy: CALLER_ID,
		acceptedAt: "2026-10-06T00:00:00.000Z",
		createdAt: "2026-10-06T00:00:00.000Z",
		updatedAt: "2026-10-06T00:00:00.000Z",
		...overrides,
	};
}

function permissions(callerRole: MemberRole, target: Membership) {
	return selectMemberPermissions({
		callerRole,
		callerUserId: CALLER_ID,
		target,
	});
}

describe("isOwnMembership", () => {
	it("matches by user id", () => {
		expect(isOwnMembership(membership({ userId: CALLER_ID }), CALLER_ID)).toBe(
			true,
		);
		expect(isOwnMembership(membership({ userId: "user-9" }), CALLER_ID)).toBe(
			false,
		);
	});

	it("never treats a pending invitation as the caller's own row", () => {
		expect(isOwnMembership(membership({ userId: null }), CALLER_ID)).toBe(
			false,
		);
	});
});

describe("selectMemberPermissions", () => {
	it("keeps a MEMBER read-only on every row", () => {
		for (const role of ["MEMBER", "ADMIN", "OWNER"] as const) {
			const result = permissions(
				"MEMBER",
				membership({ role, userId: "user-9" }),
			);
			expect(result).toEqual({
				canInvite: false,
				invitableRoles: [],
				canChangeRole: false,
				canRevoke: false,
			});
		}
	});

	it("lets an ADMIN invite only MEMBER and never change a role", () => {
		const result = permissions("ADMIN", membership({ role: "MEMBER" }));

		expect(result.canInvite).toBe(true);
		expect(result.invitableRoles).toEqual(["MEMBER"]);
		expect(result.canChangeRole).toBe(false);
	});

	it("lets an ADMIN revoke a MEMBER but not an ADMIN or OWNER", () => {
		expect(permissions("ADMIN", membership({ role: "MEMBER" })).canRevoke).toBe(
			true,
		);
		expect(permissions("ADMIN", membership({ role: "ADMIN" })).canRevoke).toBe(
			false,
		);
		expect(permissions("ADMIN", membership({ role: "OWNER" })).canRevoke).toBe(
			false,
		);
	});

	it("lets an OWNER invite any role and change/revoke other rows", () => {
		const target = membership({ role: "ADMIN", userId: "user-9" });
		const result = permissions("OWNER", target);

		expect(result.canInvite).toBe(true);
		expect(result.invitableRoles).toEqual(["MEMBER", "ADMIN", "OWNER"]);
		expect(result.canChangeRole).toBe(true);
		expect(result.canRevoke).toBe(true);
	});

	it("hides the role control on the caller's own row, even for an OWNER", () => {
		const result = permissions("OWNER", membership({ userId: CALLER_ID }));

		expect(result.canChangeRole).toBe(false);
	});

	it("never offers revoking your own row: that is leaving", () => {
		const result = permissions("OWNER", membership({ userId: CALLER_ID }));

		expect(result.canRevoke).toBe(false);
	});

	it("keeps a REVOKED row read-only even for an OWNER", () => {
		const result = permissions(
			"OWNER",
			membership({ status: "REVOKED", userId: "user-9" }),
		);

		expect(result.canChangeRole).toBe(false);
		expect(result.canRevoke).toBe(false);
	});

	it("treats an INVITED row by its role for an OWNER", () => {
		const result = permissions(
			"OWNER",
			membership({ status: "INVITED", userId: null, role: "MEMBER" }),
		);

		expect(result.canChangeRole).toBe(true);
		expect(result.canRevoke).toBe(true);
	});
});

describe("canInviteMembers and invitableRolesFor", () => {
	it("keeps a MEMBER out of inviting", () => {
		expect(canInviteMembers("MEMBER")).toBe(false);
		expect(invitableRolesFor("MEMBER")).toEqual([]);
	});

	it("lets an ADMIN invite only MEMBER", () => {
		expect(canInviteMembers("ADMIN")).toBe(true);
		expect(invitableRolesFor("ADMIN")).toEqual(["MEMBER"]);
	});

	it("lets an OWNER invite any role", () => {
		expect(canInviteMembers("OWNER")).toBe(true);
		expect(invitableRolesFor("OWNER")).toEqual(["MEMBER", "ADMIN", "OWNER"]);
	});
});

describe("countActiveOwners", () => {
	it("counts only ACTIVE owners", () => {
		const roster = [
			membership({ id: "m1", role: "OWNER", status: "ACTIVE" }),
			membership({ id: "m2", role: "OWNER", status: "INVITED", userId: null }),
			membership({ id: "m3", role: "OWNER", status: "REVOKED" }),
			membership({ id: "m4", role: "ADMIN", status: "ACTIVE" }),
		];

		expect(countActiveOwners(roster)).toBe(1);
	});

	it("returns zero for an empty roster", () => {
		expect(countActiveOwners([])).toBe(0);
	});
});

describe("canLeaveCompany", () => {
	it("lets a non-owner leave", () => {
		expect(canLeaveCompany({ callerRole: "MEMBER", activeOwnerCount: 1 })).toBe(
			true,
		);
		expect(canLeaveCompany({ callerRole: "ADMIN", activeOwnerCount: 1 })).toBe(
			true,
		);
	});

	it("blocks the last active OWNER", () => {
		expect(canLeaveCompany({ callerRole: "OWNER", activeOwnerCount: 1 })).toBe(
			false,
		);
		expect(canLeaveCompany({ callerRole: "OWNER", activeOwnerCount: 0 })).toBe(
			false,
		);
	});

	it("lets an OWNER leave when another active owner remains", () => {
		expect(canLeaveCompany({ callerRole: "OWNER", activeOwnerCount: 2 })).toBe(
			true,
		);
	});
});
