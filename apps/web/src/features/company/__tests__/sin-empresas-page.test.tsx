import { render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import SinEmpresasPage from "@/app/sin-empresas/page";
import { useCompanies } from "../api/use-companies";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("../api/use-companies", () => ({
	useCompanies: jest.fn(),
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
		...state,
	} as unknown as ReturnType<typeof useCompanies>);
}

describe("SinEmpresasPage", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRouter();
		mockCompanies();
	});

	it("redirects to /dashboard when the user has companies", () => {
		mockCompanies({ data: [company("c1", "Primera")] });

		render(<SinEmpresasPage />);

		expect(replace).toHaveBeenCalledWith("/dashboard");
	});

	it("shows the loading state while the companies query is pending", () => {
		mockCompanies({ isPending: true });

		render(<SinEmpresasPage />);

		expect(screen.getByLabelText("Cargando")).toBeTruthy();
		expect(replace).not.toHaveBeenCalled();
	});
});
