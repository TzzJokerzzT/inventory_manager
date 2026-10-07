import { render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import DashboardPage from "@/app/dashboard/page";
import { useCompanies } from "@/src/features/company/api/use-companies";
import { useSessionStore } from "@/src/store/session-store/session-store";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/company/api/use-companies", () => ({
	useCompanies: jest.fn(),
}));

jest.mock("@/src/features/company/components/company-switcher", () => ({
	CompanySwitcher: () => <div>switcher-stub</div>,
}));

jest.mock("@/src/features/auth/logout/use-logout", () => ({
	useLogout: jest.fn(() => () => {}),
}));

jest.mock("@/components/theme-toggle", () => ({
	ThemeToggle: () => <button type="button">theme-toggle-stub</button>,
}));

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const useCompaniesMock = useCompanies as jest.MockedFunction<
	typeof useCompanies
>;
const replace = jest.fn();

function company(id: string, name: string) {
	return { id, name, createdAt: "2026-10-06T00:00:00.000Z" };
}

function mockRouter() {
	useRouterMock.mockReturnValue({
		replace,
		push: jest.fn(),
		refresh: jest.fn(),
		back: jest.fn(),
		forward: jest.fn(),
		prefetch: jest.fn(),
	} as unknown as ReturnType<typeof useRouter>);
}

function mockCompanies(state: Partial<ReturnType<typeof useCompanies>> = {}) {
	useCompaniesMock.mockReturnValue({
		data: undefined,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
		...state,
	} as unknown as ReturnType<typeof useCompanies>);
}

describe("DashboardPage", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useSessionStore.setState({ accessToken: undefined, resolved: true });
		mockRouter();
		mockCompanies();
	});

	it("renders the dashboard inside the shell when the user has a company", () => {
		mockCompanies({ data: [company("c1", "Primera")] });

		render(<DashboardPage />);

		expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
		expect(replace).not.toHaveBeenCalled();
	});

	it("does not reach the dashboard without a company", () => {
		mockCompanies({ data: [] });

		render(<DashboardPage />);

		expect(replace).toHaveBeenCalledWith("/sin-empresas");
		expect(screen.queryByRole("heading", { name: "Dashboard" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
	});
});
