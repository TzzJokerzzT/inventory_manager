import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { useLogout } from "@/src/features/auth/logout/use-logout";
import { AppShell } from "../app-shell";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
	usePathname: jest.fn(),
}));

jest.mock("@/src/features/auth/logout/use-logout", () => ({
	useLogout: jest.fn(),
}));

jest.mock("@/src/features/company/components/company-switcher", () => ({
	CompanySwitcher: () => <div>switcher-stub</div>,
}));

/*
 * The account menu renders the create-company modal, which owns a mutation.
 * Mocking the mutation keeps this suite about the shell: no QueryClient and no
 * request are needed to prove where the account actions live.
 */
jest.mock("@/src/features/company/api/use-create-company", () => ({
	useCreateCompany: () => ({
		mutate: jest.fn(),
		isPending: false,
		error: undefined,
	}),
}));

const useLogoutMock = useLogout as jest.MockedFunction<typeof useLogout>;
const usePathnameMock = usePathname as jest.MockedFunction<typeof usePathname>;
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
		usePathnameMock.mockReturnValue("/dashboard");
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

	it("shows the company switcher and the account menu", () => {
		render(<AppShell>contenido</AppShell>);

		expect(screen.getByText("switcher-stub")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Cuenta" })).toBeTruthy();
	});

	it("logs out from the account menu", () => {
		render(<AppShell>contenido</AppShell>);

		fireEvent.click(screen.getByRole("button", { name: "Cuenta" }));
		fireEvent.click(screen.getByRole("menuitem", { name: /cerrar sesión/i }));

		expect(logout).toHaveBeenCalled();
	});

	it("renders its content next to the navigation", () => {
		render(<AppShell>contenido</AppShell>);

		expect(screen.getByText("contenido")).toBeTruthy();
	});

	/**
	 * The scroll contract: the shell is pinned outside the document flow and
	 * `main` is the only scroll container, so scrolling the content to the end
	 * can never drag the sidebar or the header away with it.
	 */
	it("pins the shell and keeps the scroll inside main", () => {
		const { container } = render(<AppShell>contenido</AppShell>);
		const shell = container.firstElementChild as HTMLElement;
		const main = screen.getByRole("main");

		expect(shell.className).toContain("fixed");
		expect(shell.className).toContain("inset-0");
		expect(shell.className).toContain("overflow-hidden");
		expect(main.className).toContain("overflow-y-auto");
		expect(main.className).toContain("overscroll-contain");
		expect(main.className).toContain("min-h-0");
	});
});
