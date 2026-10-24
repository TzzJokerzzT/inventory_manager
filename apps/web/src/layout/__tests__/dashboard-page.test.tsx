import { render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/dashboard/layout";
import DashboardPage from "@/app/dashboard/page";
import { useCompanies } from "@/src/features/company/api/use-companies";
import { useMovementTrend } from "@/src/features/dashboard/api/use-movement-trend";
import { useProducts } from "@/src/features/product/api/use-products";
import { useSessionStore } from "@/src/store/session-store/session-store";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
	usePathname: jest.fn(() => "/dashboard"),
}));

jest.mock("@/src/features/company/api/use-companies", () => ({
	useCompanies: jest.fn(),
}));

jest.mock("@/src/features/company/components/company-switcher", () => ({
	CompanySwitcher: () => <div>switcher-stub</div>,
}));

// Preference persistence has its own suite; the dashboard render test keeps the
// guard's behavior isolated from the browser storage.
jest.mock("@/src/features/company/store/use-company-preference", () => ({
	useCompanyPreference: () => undefined,
}));

jest.mock("@/src/features/auth/logout/use-logout", () => ({
	useLogout: jest.fn(() => () => {}),
}));

// The shell's account menu mounts the create-company modal, which owns a
// mutation. Stubbing the mutation keeps this a route/shell test: no QueryClient
// and no request are needed to prove the dashboard renders.
jest.mock("@/src/features/company/api/use-create-company", () => ({
	useCreateCompany: () => ({
		mutate: jest.fn(),
		isPending: false,
		error: undefined,
	}),
}));

// The dashboard now renders real-data charts, so these two reads are stubbed to
// keep this a route/shell integration test: it must not depend on the API nor
// on a QueryClient the route does not own.
jest.mock("@/src/features/product/api/use-products", () => ({
	useProducts: jest.fn(),
}));

jest.mock("@/src/features/dashboard/api/use-movement-trend", () => ({
	...jest.requireActual("@/src/features/dashboard/api/use-movement-trend"),
	useMovementTrend: jest.fn(),
}));

jest.mock("recharts", () =>
	jest.requireActual("@/src/features/dashboard/testing/recharts-mock"),
);

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const useCompaniesMock = useCompanies as jest.MockedFunction<
	typeof useCompanies
>;
const useProductsMock = useProducts as jest.MockedFunction<typeof useProducts>;
const useMovementTrendMock = useMovementTrend as jest.MockedFunction<
	typeof useMovementTrend
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
		useProductsMock.mockReturnValue({
			data: [],
			isPending: false,
			isError: false,
			error: undefined,
		} as unknown as ReturnType<typeof useProducts>);
		useMovementTrendMock.mockReturnValue({
			data: { days: 30, series: [] },
			isPending: false,
			isError: false,
			error: undefined,
		} as unknown as ReturnType<typeof useMovementTrend>);
	});

	/**
	 * `/dashboard/page.tsx` is now content-only (`DashboardView`); the shell and
	 * the company gate live in `/dashboard/layout.tsx`. Rendering the layout
	 * around the page keeps this an integration test of the full dashboard route.
	 */
	it("renders the dashboard inside the shell when the user has a company", () => {
		mockCompanies({ data: [company("c1", "Primera")] });

		render(
			<DashboardLayout>
				<DashboardPage />
			</DashboardLayout>,
		);

		expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
		expect(replace).not.toHaveBeenCalled();
	});

	it("does not reach the dashboard without a company", () => {
		mockCompanies({ data: [] });

		render(
			<DashboardLayout>
				<DashboardPage />
			</DashboardLayout>,
		);

		expect(replace).toHaveBeenCalledWith("/sin-empresas");
		expect(screen.queryByRole("heading", { name: "Dashboard" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
	});
});
