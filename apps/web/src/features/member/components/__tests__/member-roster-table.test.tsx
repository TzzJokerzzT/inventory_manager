import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Membership } from "@/lib/api/schemas";
import { useChangeMemberRole } from "../../api/use-change-member-role";
import { useRevokeMember } from "../../api/use-revoke-member";
import type { MemberRole } from "../../lib/member-permissions";
import { MemberRosterTable } from "../member-roster-table";

jest.mock("../../api/use-change-member-role", () => ({
	useChangeMemberRole: jest.fn(),
}));

jest.mock("../../api/use-revoke-member", () => ({
	useRevokeMember: jest.fn(),
}));

const useChangeMemberRoleMock = useChangeMemberRole as jest.MockedFunction<
	typeof useChangeMemberRole
>;
const useRevokeMemberMock = useRevokeMember as jest.MockedFunction<
	typeof useRevokeMember
>;
const changeRole = jest.fn();
const revoke = jest.fn();

function mockChangeRole(
	state: Partial<ReturnType<typeof useChangeMemberRole>> = {},
) {
	useChangeMemberRoleMock.mockReturnValue({
		mutate: changeRole,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useChangeMemberRole>);
}

function mockRevoke(state: Partial<ReturnType<typeof useRevokeMember>> = {}) {
	useRevokeMemberMock.mockReturnValue({
		mutate: revoke,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useRevokeMember>);
}

function member(id: string, role: MemberRole): Membership {
	return {
		id,
		userId: `user-${id}`,
		invitedEmail: `${id}@empresa.com`,
		companyId: "c1",
		role,
		status: "ACTIVE",
		invitedBy: "user-1",
		acceptedAt: "2026-10-06T00:00:00.000Z",
		createdAt: "2026-10-06T00:00:00.000Z",
		updatedAt: "2026-10-06T00:00:00.000Z",
	};
}

function renderTable({
	members,
	callerRole,
	callerUserId,
}: {
	members: Membership[];
	callerRole: MemberRole;
	callerUserId: string;
}) {
	return render(
		<MemberRosterTable
			companyId="c1"
			members={members}
			callerRole={callerRole}
			callerUserId={callerUserId}
		/>,
	);
}

describe("MemberRosterTable", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockChangeRole();
		mockRevoke();
	});

	it("lists email, role and status for every member", () => {
		renderTable({
			members: [member("m1", "OWNER"), member("m2", "MEMBER")],
			callerRole: "OWNER",
			callerUserId: "user-m1",
		});

		expect(screen.getByText("m1@empresa.com")).toBeTruthy();
		expect(screen.getByText("Propietario")).toBeTruthy();
		expect(screen.getByText("m2@empresa.com")).toBeTruthy();
		expect(screen.getAllByText("Activo")).toHaveLength(2);
	});

	it("keeps every row read-only for a MEMBER", () => {
		renderTable({
			members: [member("m1", "OWNER"), member("m2", "MEMBER")],
			callerRole: "MEMBER",
			callerUserId: "user-m2",
		});

		expect(screen.getAllByText("—")).toHaveLength(2);
		expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Cambiar rol" })).toBeNull();
	});

	it("hides the role control and the revoke on the caller's own row", () => {
		renderTable({
			members: [member("m1", "OWNER"), member("m2", "MEMBER")],
			callerRole: "OWNER",
			callerUserId: "user-m1",
		});

		// Only the caller's own row is read-only; the other row is actionable.
		expect(screen.getByText("—")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Cambiar rol" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Quitar" })).toBeTruthy();
	});

	it("lets an ADMIN revoke a MEMBER but not an ADMIN", () => {
		renderTable({
			members: [member("m1", "ADMIN"), member("m2", "MEMBER")],
			callerRole: "ADMIN",
			callerUserId: "user-m1",
		});

		expect(screen.getAllByText("—")).toHaveLength(1);
		expect(screen.getAllByRole("button", { name: "Quitar" })).toHaveLength(1);
		expect(screen.queryByRole("button", { name: "Cambiar rol" })).toBeNull();
	});

	it("changes a role only after an explicit confirmation", () => {
		renderTable({
			members: [member("m2", "MEMBER")],
			callerRole: "OWNER",
			callerUserId: "user-1",
		});

		fireEvent.click(screen.getByRole("button", { name: "Cambiar rol" }));
		fireEvent.change(screen.getByLabelText("Rol de m2@empresa.com"), {
			target: { value: "ADMIN" },
		});
		// Selecting a role must not call the API on its own.
		expect(changeRole).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Guardar rol" }));
		fireEvent.click(screen.getByRole("button", { name: "Sí, cambiar" }));

		expect(changeRole).toHaveBeenCalledWith(
			{ membershipId: "m2", role: "ADMIN" },
			expect.any(Object),
		);
	});

	it("revokes only after an explicit confirmation", () => {
		renderTable({
			members: [member("m2", "MEMBER")],
			callerRole: "OWNER",
			callerUserId: "user-1",
		});

		fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
		expect(revoke).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Sí, quitar" }));

		expect(revoke).toHaveBeenCalledWith({ membershipId: "m2" });
	});

	it("renders the server's last_active_owner error", () => {
		mockRevoke({
			isError: true,
			error: new ApiError("conflict", 409, "last_active_owner"),
		});
		renderTable({
			members: [member("m2", "MEMBER")],
			callerRole: "OWNER",
			callerUserId: "user-1",
		});

		fireEvent.click(screen.getByRole("button", { name: "Quitar" }));

		expect(
			screen.getByText("No se puede quitar al último propietario activo."),
		).toBeTruthy();
	});
});
