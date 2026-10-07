import { fireEvent, render, screen } from "@testing-library/react";
import { useLogout } from "@/src/features/auth/logout/use-logout";
import { AppShell } from "../components/app-shell";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/auth/logout/use-logout", () => ({
	useLogout: jest.fn(),
}));

jest.mock("@/src/features/company/components/company-switcher", () => ({
	CompanySwitcher: () => <div>switcher-stub</div>,
}));

jest.mock("@/components/theme-toggle", () => ({
	ThemeToggle: () => <button type="button">theme-toggle-stub</button>,
}));

const useLogoutMock = useLogout as jest.MockedFunction<typeof useLogout>;
const logout = jest.fn();

const disabledEntries = [
	{ label: "Productos", mi: "MI-21" },
	{ label: "Movimientos", mi: "MI-26" },
	{ label: "Clientes", mi: "MI-24" },
] as const;

describe("AppShell", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useLogoutMock.mockReturnValue(logout);
	});

	it("renders the dashboard link as the only enabled navigation entry", () => {
		render(<AppShell>contenido</AppShell>);

		const link = screen.getByRole("link", { name: "Dashboard" });
		expect(link.getAttribute("href")).toBe("/dashboard");
	});

	it("renders the non-existent routes disabled and labelled with their MI", () => {
		render(<AppShell>contenido</AppShell>);

		for (const { label, mi } of disabledEntries) {
			expect(screen.queryByRole("link", { name: label })).toBeNull();
			expect(
				screen
					.getByText(label)
					.closest("[aria-disabled]")
					?.getAttribute("aria-disabled"),
			).toBe("true");
			expect(screen.getByText(mi)).toBeTruthy();
		}
	});

	it("shows the company switcher, the logout user area and the theme toggle", () => {
		render(<AppShell>contenido</AppShell>);

		expect(screen.getByText("switcher-stub")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Salir" })).toBeTruthy();
		expect(screen.getByText("theme-toggle-stub")).toBeTruthy();
	});

	it("logs out from the user area", () => {
		render(<AppShell>contenido</AppShell>);

		fireEvent.click(screen.getByRole("button", { name: "Salir" }));

		expect(logout).toHaveBeenCalled();
	});

	it("renders its content next to the navigation", () => {
		render(<AppShell>contenido</AppShell>);

		expect(screen.getByText("contenido")).toBeTruthy();
	});
});
