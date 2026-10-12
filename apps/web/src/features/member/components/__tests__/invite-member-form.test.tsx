import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import { useInviteMember } from "../../api/use-invite-member";
import { InviteMemberForm } from "../invite-member-form";

jest.mock("../../api/use-invite-member", () => ({
	useInviteMember: jest.fn(),
}));

const useInviteMemberMock = useInviteMember as jest.MockedFunction<
	typeof useInviteMember
>;
const mutate = jest.fn();

function mockInvite(state: Partial<ReturnType<typeof useInviteMember>> = {}) {
	useInviteMemberMock.mockReturnValue({
		mutate,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useInviteMember>);
}

function submit() {
	fireEvent.click(screen.getByRole("button", { name: /Invitar|Invitando.../ }));
}

function fillEmail(value: string) {
	fireEvent.change(screen.getByLabelText("Correo electrónico"), {
		target: { value },
	});
}

describe("InviteMemberForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockInvite();
	});

	it("renders the email field, the role options and the submit button", () => {
		render(
			<InviteMemberForm
				companyId="c1"
				invitableRoles={["MEMBER", "ADMIN", "OWNER"]}
			/>,
		);

		expect(screen.getByLabelText("Correo electrónico")).toBeTruthy();
		expect(screen.getByLabelText("Rol")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Invitar" })).toBeTruthy();
	});

	it("only offers the roles the caller may hand out", () => {
		render(<InviteMemberForm companyId="c1" invitableRoles={["MEMBER"]} />);

		const options = Array.from(
			(screen.getByLabelText("Rol") as HTMLSelectElement).options,
		).map((option) => option.value);

		expect(options).toEqual(["MEMBER"]);
	});

	it("reports an empty email locally, without calling the API", () => {
		render(<InviteMemberForm companyId="c1" invitableRoles={["MEMBER"]} />);

		submit();

		const input = screen.getByLabelText("Correo electrónico");
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(
			screen.getByText("Ingresá el correo de la persona a invitar."),
		).toBeTruthy();
		expect(mutate).not.toHaveBeenCalled();
	});

	it("reports an invalid email locally, without calling the API", () => {
		render(<InviteMemberForm companyId="c1" invitableRoles={["MEMBER"]} />);
		fillEmail("no-es-un-correo");

		submit();

		expect(
			screen.getByText("Ingresá un correo electrónico válido."),
		).toBeTruthy();
		expect(mutate).not.toHaveBeenCalled();
	});

	it("sends the trimmed email and the chosen role", () => {
		render(
			<InviteMemberForm
				companyId="c1"
				invitableRoles={["MEMBER", "ADMIN", "OWNER"]}
			/>,
		);
		fillEmail("  nueva@empresa.com  ");
		fireEvent.change(screen.getByLabelText("Rol"), {
			target: { value: "ADMIN" },
		});

		submit();

		expect(mutate).toHaveBeenCalledWith(
			{ email: "nueva@empresa.com", role: "ADMIN" },
			expect.any(Object),
		);
	});

	it("translates membership_already_exists into a readable message", () => {
		mockInvite({
			isError: true,
			error: new ApiError("conflict", 409, "membership_already_exists"),
		});
		render(<InviteMemberForm companyId="c1" invitableRoles={["MEMBER"]} />);

		expect(
			screen.getByText(
				"Ese correo ya pertenece a la empresa o tiene una invitación pendiente.",
			),
		).toBeTruthy();
	});

	it("translates insufficient_role into a readable message", () => {
		mockInvite({
			isError: true,
			error: new ApiError("forbidden", 403, "insufficient_role"),
		});
		render(<InviteMemberForm companyId="c1" invitableRoles={["MEMBER"]} />);

		expect(
			screen.getByText("Tu rol no permite invitar con ese rol."),
		).toBeTruthy();
	});

	it("shows a busy state and blocks the fields while in flight", () => {
		mockInvite({ isPending: true });
		render(<InviteMemberForm companyId="c1" invitableRoles={["MEMBER"]} />);

		expect(screen.getByRole("button", { name: /Invitando.../ })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByLabelText("Correo electrónico")).toHaveProperty(
			"disabled",
			true,
		);
	});
});
