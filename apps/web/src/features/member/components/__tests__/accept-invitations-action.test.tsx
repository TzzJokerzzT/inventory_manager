import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import { useAcceptInvitations } from "../../api/use-accept-invitations";
import { AcceptInvitationsAction } from "../accept-invitations-action";

jest.mock("../../api/use-accept-invitations", () => ({
	useAcceptInvitations: jest.fn(),
}));

const useAcceptInvitationsMock = useAcceptInvitations as jest.MockedFunction<
	typeof useAcceptInvitations
>;
const mutate = jest.fn();

function mockAccept(
	state: Partial<ReturnType<typeof useAcceptInvitations>> = {},
) {
	useAcceptInvitationsMock.mockReturnValue({
		mutate,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useAcceptInvitations>);
}

function clickAccept() {
	fireEvent.click(
		screen.getByRole("button", { name: /Aceptar invitación pendiente/ }),
	);
}

describe("AcceptInvitationsAction", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockAccept();
	});

	it("renders the secondary accept action", () => {
		render(<AcceptInvitationsAction />);

		expect(
			screen.getByRole("button", { name: "Aceptar invitación pendiente" }),
		).toBeTruthy();
	});

	it("calls the accept hook when clicked", () => {
		render(<AcceptInvitationsAction />);

		clickAccept();

		expect(mutate).toHaveBeenCalledWith(undefined, expect.any(Object));
	});

	it("says there is nothing pending when the API answers an empty list", () => {
		mutate.mockImplementation((_variables, options) => {
			options?.onSuccess?.([]);
		});
		render(<AcceptInvitationsAction />);

		clickAccept();

		expect(screen.getByText("No tenés invitaciones pendientes.")).toBeTruthy();
	});

	it("stays quiet when an invitation was accepted, leaving the redirect to run", () => {
		mutate.mockImplementation((_variables, options) => {
			options?.onSuccess?.([{ id: "m1", status: "ACTIVE" }]);
		});
		render(<AcceptInvitationsAction />);

		clickAccept();

		expect(screen.queryByText("No tenés invitaciones pendientes.")).toBeNull();
	});

	it("tells the panel what changed, because there is no redirect to run there", () => {
		mutate.mockImplementation((_variables, options) => {
			options?.onSuccess?.([{ id: "m1", status: "ACTIVE" }]);
		});
		render(<AcceptInvitationsAction variant="panel" />);

		clickAccept();

		expect(
			screen.getByText(
				"Ya sos miembro. Vas a encontrar la empresa en el selector de empresas.",
			),
		).toBeTruthy();
	});

	it("says nothing was pending in the panel too", () => {
		mutate.mockImplementation((_variables, options) => {
			options?.onSuccess?.([]);
		});
		render(<AcceptInvitationsAction variant="panel" />);

		clickAccept();

		expect(screen.getByText("No tenés invitaciones pendientes.")).toBeTruthy();
	});

	it("shows the API message when accepting fails", () => {
		mockAccept({
			isError: true,
			error: new ApiError("No autorizado", 403),
		});
		render(<AcceptInvitationsAction />);

		expect(screen.getByText("No autorizado")).toBeTruthy();
	});

	it("shows a busy state while in flight", () => {
		mockAccept({ isPending: true });
		render(<AcceptInvitationsAction />);

		expect(screen.getByRole("button", { name: /Aceptando.../ })).toHaveProperty(
			"disabled",
			true,
		);
	});
});
