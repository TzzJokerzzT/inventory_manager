import { render, screen } from "@testing-library/react";
import type { Membership } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useMe } from "@/src/features/user/api/use-me";
import { useChangeMemberRole } from "../../api/use-change-member-role";
import { useInviteMember } from "../../api/use-invite-member";
import { useLeaveCompany } from "../../api/use-leave-company";
import { useMembers } from "../../api/use-members";
import { useRevokeMember } from "../../api/use-revoke-member";
import type { MemberRole } from "../../lib/member-permissions";
import { MembersSection } from "../members-section";

jest.mock("@/src/features/company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(),
}));

jest.mock("@/src/features/user/api/use-me", () => ({
	useMe: jest.fn(),
}));

jest.mock("../../api/use-members", () => ({
	useMembers: jest.fn(),
}));

jest.mock("../../api/use-invite-member", () => ({
	useInviteMember: jest.fn(),
}));

jest.mock("../../api/use-change-member-role", () => ({
	useChangeMemberRole: jest.fn(),
}));

jest.mock("../../api/use-revoke-member", () => ({
	useRevokeMember: jest.fn(),
}));

jest.mock("../../api/use-leave-company", () => ({
	useLeaveCompany: jest.fn(),
}));

const useActiveCompanyMock = useActiveCompany as jest.MockedFunction<
	typeof useActiveCompany
>;
const useMeMock = useMe as jest.MockedFunction<typeof useMe>;
const useMembersMock = useMembers as jest.MockedFunction<typeof useMembers>;
const useInviteMemberMock = useInviteMember as jest.MockedFunction<
	typeof useInviteMember
>;
const useChangeMemberRoleMock = useChangeMemberRole as jest.MockedFunction<
	typeof useChangeMemberRole
>;
const useRevokeMemberMock = useRevokeMember as jest.MockedFunction<
	typeof useRevokeMember
>;
const useLeaveCompanyMock = useLeaveCompany as jest.MockedFunction<
	typeof useLeaveCompany
>;

function stub() {
	return {
		mutate: jest.fn(),
		isPending: false,
		isError: false,
		error: undefined,
	};
}

function member(id: string, role: MemberRole, userId: string): Membership {
	return {
		id,
		userId,
		invitedEmail: `${id}@empresa.com`,
		companyId: "c1",
		role,
		status: "ACTIVE",
		invitedBy: "user-m1",
		acceptedAt: "2026-10-06T00:00:00.000Z",
		createdAt: "2026-10-06T00:00:00.000Z",
		updatedAt: "2026-10-06T00:00:00.000Z",
	};
}

function setup({
	callerRole,
	roster,
	hasMembership = true,
}: {
	callerRole: MemberRole;
	roster: Membership[];
	hasMembership?: boolean;
}) {
	useActiveCompanyMock.mockReturnValue({
		id: "c1",
		name: "Empresa Uno",
		createdAt: "2026-10-06T00:00:00.000Z",
	});
	useMeMock.mockReturnValue({
		data: {
			id: "user-m1",
			email: "ana@empresa.com",
			fullName: "Ana Pérez",
			createdAt: "2026-10-06T00:00:00.000Z",
			memberships: hasMembership
				? [
						{
							companyId: "c1",
							role: callerRole,
							company: {
								id: "c1",
								name: "Empresa Uno",
								createdAt: "2026-10-06T00:00:00.000Z",
							},
						},
					]
				: [],
		},
		isPending: false,
		isError: false,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useMe>);
	useMembersMock.mockReturnValue({
		data: roster,
		isPending: false,
		isError: false,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useMembers>);
	useInviteMemberMock.mockReturnValue(
		stub() as unknown as ReturnType<typeof useInviteMember>,
	);
	useChangeMemberRoleMock.mockReturnValue(
		stub() as unknown as ReturnType<typeof useChangeMemberRole>,
	);
	useRevokeMemberMock.mockReturnValue(
		stub() as unknown as ReturnType<typeof useRevokeMember>,
	);
	useLeaveCompanyMock.mockReturnValue(
		stub() as unknown as ReturnType<typeof useLeaveCompany>,
	);
}

function ownerAnd(role: MemberRole) {
	return [member("m1", "OWNER", "user-m1"), member("m2", role, "user-m2")];
}

describe("MembersSection", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("lists the roster of the active company", () => {
		setup({ callerRole: "OWNER", roster: ownerAnd("MEMBER") });

		render(<MembersSection />);

		expect(
			screen.getByRole("heading", { name: "Miembros de la empresa" }),
		).toBeTruthy();
		expect(screen.getByText("m2@empresa.com")).toBeTruthy();
	});

	it("offers the invite form to an OWNER", () => {
		setup({
			callerRole: "OWNER",
			roster: [member("m1", "OWNER", "user-m1")],
		});

		render(<MembersSection />);

		expect(screen.getByLabelText("Correo electrónico")).toBeTruthy();
	});

	it("hides the invite form from a MEMBER", () => {
		setup({ callerRole: "MEMBER", roster: ownerAnd("MEMBER") });

		render(<MembersSection />);

		expect(screen.queryByLabelText("Correo electrónico")).toBeNull();
	});

	it("disables leaving for the last active OWNER", () => {
		setup({
			callerRole: "OWNER",
			roster: [member("m1", "OWNER", "user-m1")],
		});

		render(<MembersSection />);

		expect(
			screen.getByRole("button", { name: "Salir de la empresa" }),
		).toHaveProperty("disabled", true);
	});

	it("enables leaving when another active OWNER remains", () => {
		setup({ callerRole: "OWNER", roster: ownerAnd("OWNER") });

		render(<MembersSection />);

		expect(
			screen.getByRole("button", { name: "Salir de la empresa" }),
		).toHaveProperty("disabled", false);
	});

	it("stays read-only until /me proves a membership in the active company", () => {
		setup({
			callerRole: "MEMBER",
			roster: [member("m1", "OWNER", "user-m1")],
			hasMembership: false,
		});

		render(<MembersSection />);

		expect(screen.queryByLabelText("Correo electrónico")).toBeNull();
		expect(
			screen.getByRole("button", { name: "Salir de la empresa" }),
		).toHaveProperty("disabled", true);
	});
});
