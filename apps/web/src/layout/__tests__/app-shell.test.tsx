import { fireEvent, render, screen } from "@testing-library/react";
import { useLogout } from "@/src/features/auth/logout/use-logout";
import { AppShell } from "../app-shell";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/auth/logout/use-logout", () => ({
	useLogout: jest.fn(),
}));

jest.mock("@/src/features/company/components/company-switcher", () => ({
	CompanySwitcher: () => <div>switcher-stub</div>,
}));

const useLogoutMock = useLogout as jest.MockedFunction<typeof useLogout>;
const logout = jest.fn();

/*
 * Every entry here maps to a route that is actually mounted under
 * `/dashboard`. The navigation must never point at a 404, so these must stay
 * real links; a not-yet-built module is rendered disabled (see app-shell.tsx)
 * instead of being linked.
 */
const navLinks = [
	{ href: "/dashboard", label: "Dashboard" },
	{ href: "/dashboard/products", label: "Productos" },
	{ href: "/dashboard/movements", label: "Movimientos" },
	{ href: "/dashboard/clients", label: "Clientes" },
] as const;

describe("AppShell", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useLogoutMock.mockReturnValue(logout);
	});

	it("renders a real link for every route that exists", () => {
		render(<AppShell>contenido</AppShell>);

		for (const { href, label } of navLinks) {
			const link = screen.getByRole("link", { name: label });
			expect(link.getAttribute("href")).toBe(href);
		}
	});

	it("renders no disabled navigation entries while every route exists", () => {
		const { container } = render(<AppShell>contenido</AppShell>);

		// The honest-not-link treatment is reserved for modules that do not
		// exist yet; today every entry maps to a mounted route.
		expect(container.querySelector("[aria-disabled]")).toBeNull();
	});

	it("shows the company switcher and the logout control", () => {
		render(<AppShell>contenido</AppShell>);

		expect(screen.getByText("switcher-stub")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Salir" })).toBeTruthy();
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
