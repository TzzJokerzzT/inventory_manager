import { render, screen } from "@testing-library/react";
import { useCompanies } from "@/src/features/company/api/use-companies";
import { useCompanyStore } from "@/src/features/company/store/company-store";
import { DashboardView } from "../components/dashboard-view";
import { dashboardKpis, stockTableRows } from "../mock";

jest.mock("@/src/features/company/api/use-companies", () => ({
	useCompanies: jest.fn(),
}));

const useCompaniesMock = useCompanies as jest.MockedFunction<
	typeof useCompanies
>;

function company(id: string, name: string) {
	return { id, name, createdAt: "2026-10-06T00:00:00.000Z" };
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

describe("DashboardView", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useCompanyStore.setState({ activeCompanyId: undefined });
		mockCompanies({ data: [company("c1", "Primera")] });
	});

	it("renders the KPI cards from the mock module", () => {
		render(<DashboardView />);

		for (const kpi of dashboardKpis) {
			expect(screen.getByText(kpi.label)).toBeTruthy();
		}
		expect(screen.getByText("1.248")).toBeTruthy();
		expect(screen.getByText("$ 84.320")).toBeTruthy();
	});

	it("shows a visible sample-data notice that cannot be mistaken for real data", () => {
		render(<DashboardView />);

		const notice = screen.getByRole("status");
		expect(notice).toBeTruthy();
		expect(notice.textContent).toContain("Datos de muestra");
		expect(notice.textContent).toContain("números de ejemplo");
	});

	it("renders the stock table rows through DataTable", () => {
		const { container } = render(<DashboardView />);

		expect(container.querySelector('[data-slot="data-table"]')).toBeTruthy();
		for (const row of stockTableRows) {
			expect(screen.getByText(row.name)).toBeTruthy();
			expect(screen.getByText(row.sku)).toBeTruthy();
		}
	});

	it("maps each stock badge status to its visible label", () => {
		render(<DashboardView />);

		expect(screen.getByText("Agotado")).toBeTruthy();
		expect(screen.getByText("Stock bajo")).toBeTruthy();
		expect(screen.getByText("En stock")).toBeTruthy();
	});

	it("shows the real active company from the mocked query", () => {
		render(<DashboardView />);

		expect(screen.getByText("Primera")).toBeTruthy();
	});
});
