import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { useLogout } from "@/src/features/auth/logout/use-logout";
import { UserMenu } from "../user-menu";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/auth/logout/use-logout", () => ({
	useLogout: jest.fn(),
}));

/*
 * The menu mounts the create-company modal, so its mutation is mocked here: this
 * suite is about the account actions and the modal has its own.
 */
jest.mock("@/src/features/company/api/use-create-company", () => ({
	useCreateCompany: () => ({
		mutate: jest.fn(),
		isPending: false,
		error: undefined,
	}),
}));

const useLogoutMock = useLogout as jest.MockedFunction<typeof useLogout>;
const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const logout = jest.fn();

function openMenu() {
	fireEvent.click(screen.getByRole("button", { name: "Cuenta" }));
}

describe("UserMenu", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useLogoutMock.mockReturnValue(logout);
		useRouterMock.mockReturnValue({
			push: jest.fn(),
			replace: jest.fn(),
			refresh: jest.fn(),
			back: jest.fn(),
			forward: jest.fn(),
			prefetch: jest.fn(),
		} as unknown as ReturnType<typeof useRouter>);
	});

	it("keeps its items closed until the trigger is pressed", () => {
		render(<UserMenu />);

		expect(screen.queryByRole("menu")).toBeNull();
		expect(screen.getByRole("button", { name: "Cuenta" })).toBeTruthy();
	});

	it("offers the two account actions", () => {
		render(<UserMenu />);

		openMenu();

		expect(
			screen.getByRole("menuitem", { name: /crear empresa/i }),
		).toBeTruthy();
		expect(
			screen.getByRole("menuitem", { name: /cerrar sesión/i }),
		).toBeTruthy();
	});

	it("signs out from its own item", () => {
		render(<UserMenu />);

		openMenu();
		fireEvent.click(screen.getByRole("menuitem", { name: /cerrar sesión/i }));

		expect(logout).toHaveBeenCalledTimes(1);
		// The menu closes itself so a second click cannot sign out twice.
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("opens the create-company dialog from its item", () => {
		render(<UserMenu />);

		openMenu();
		fireEvent.click(screen.getByRole("menuitem", { name: /crear empresa/i }));

		expect(screen.getByRole("dialog", { name: /crear empresa/i })).toBeTruthy();
		expect(screen.getByLabelText("Nombre de la empresa")).toBeTruthy();
	});

	it("closes the menu with Escape", () => {
		render(<UserMenu />);

		openMenu();
		fireEvent.keyDown(window, { key: "Escape" });

		expect(screen.queryByRole("menu")).toBeNull();
	});
});
