import { render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import SinEmpresasPage from "@/app/sin-empresas/page";
import { ApiError } from "@/lib/api/client";
import { useCompanies } from "@/src/features/company/api/use-companies";
import { useCreateCompany } from "@/src/features/company/api/use-create-company";
import { useMe } from "@/src/features/user/api/use-me";
import { useUpdateFullName } from "@/src/features/user/api/use-update-full-name";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/company/api/use-companies", () => ({
	useCompanies: jest.fn(),
}));

jest.mock("@/src/features/company/api/use-create-company", () => ({
	useCreateCompany: jest.fn(),
}));

jest.mock("@/src/features/user/api/use-me", () => ({
	useMe: jest.fn(),
}));

jest.mock("@/src/features/user/api/use-update-full-name", () => ({
	useUpdateFullName: jest.fn(),
}));

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const useCompaniesMock = useCompanies as jest.MockedFunction<
	typeof useCompanies
>;
const useCreateCompanyMock = useCreateCompany as jest.MockedFunction<
	typeof useCreateCompany
>;
const useMeMock = useMe as jest.MockedFunction<typeof useMe>;
const useUpdateFullNameMock = useUpdateFullName as jest.MockedFunction<
	typeof useUpdateFullName
>;
const replace = jest.fn();

function company(id: string, name: string) {
	return { id, name, createdAt: "2026-10-06T00:00:00.000Z" };
}

function meResponse(fullName: string | null) {
	return {
		id: "user-1",
		email: "ana@empresa.com",
		fullName,
		createdAt: "2026-10-06T00:00:00.000Z",
		memberships: [],
	};
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

function mockMe(state: Partial<ReturnType<typeof useMe>> = {}) {
	useMeMock.mockReturnValue({
		data: undefined,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useMe>);
}

function mockCreateCompany() {
	useCreateCompanyMock.mockReturnValue({
		mutate: jest.fn(),
		isPending: false,
		isError: false,
		error: undefined,
	} as unknown as ReturnType<typeof useCreateCompany>);
}

function mockUpdateFullName() {
	useUpdateFullNameMock.mockReturnValue({
		mutate: jest.fn(),
		isPending: false,
		isError: false,
		error: undefined,
	} as unknown as ReturnType<typeof useUpdateFullName>);
}

describe("SinEmpresasPage", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRouter();
		mockCompanies();
		mockMe();
		mockCreateCompany();
		mockUpdateFullName();
	});

	it("redirects to /dashboard when the user has companies", () => {
		mockCompanies({ data: [company("c1", "Primera")] });
		mockMe({ data: meResponse("Ana Pérez") });

		render(<SinEmpresasPage />);

		expect(replace).toHaveBeenCalledWith("/dashboard");
		expect(screen.queryByLabelText("Nombre completo")).toBeNull();
	});

	it("shows the loading state while the companies query is pending", () => {
		mockCompanies({ isPending: true });

		render(<SinEmpresasPage />);

		expect(screen.getByLabelText("Cargando")).toBeTruthy();
		expect(replace).not.toHaveBeenCalled();
	});

	it("shows the loading state while /me is pending", () => {
		mockCompanies({ data: [] });
		mockMe({ isPending: true });

		render(<SinEmpresasPage />);

		expect(screen.getByLabelText("Cargando")).toBeTruthy();
		expect(screen.queryByLabelText("Nombre completo")).toBeNull();
	});

	it("asks for the name before offering the company card when /me has none", () => {
		mockCompanies({ data: [] });
		mockMe({ data: meResponse(null) });

		render(<SinEmpresasPage />);

		expect(screen.getByLabelText("Nombre completo")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Guardar nombre" })).toBeTruthy();
		expect(screen.queryByText("Todavía no tenés una empresa")).toBeNull();
	});

	it("treats a whitespace-only name as missing", () => {
		mockCompanies({ data: [] });
		mockMe({ data: meResponse("   ") });

		render(<SinEmpresasPage />);

		expect(screen.getByLabelText("Nombre completo")).toBeTruthy();
		expect(screen.queryByText("Todavía no tenés una empresa")).toBeNull();
	});

	it("fails closed and asks for the name when /me errors", () => {
		mockCompanies({ data: [] });
		mockMe({ isError: true, error: new ApiError("boom", 500) });

		render(<SinEmpresasPage />);

		expect(screen.getByLabelText("Nombre completo")).toBeTruthy();
		expect(screen.queryByText("Todavía no tenés una empresa")).toBeNull();
	});

	it("offers the company card once the user has a name", () => {
		mockCompanies({ data: [] });
		mockMe({ data: meResponse("Ana Pérez") });

		render(<SinEmpresasPage />);

		expect(
			screen.getByRole("heading", { name: "Todavía no tenés una empresa" }),
		).toBeTruthy();
		expect(screen.queryByLabelText("Nombre completo")).toBeNull();
	});
});
