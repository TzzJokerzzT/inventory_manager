import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { useSessionStore } from "@/src/store/session-store/session-store";
import { useCompanies } from "../api/use-companies";
import { RequireActiveCompany } from "../components/require-active-company";

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
		isError: false,
		error: undefined,
		refetch: jest.fn(),
		...state,
	} as unknown as ReturnType<typeof useCompanies>);
}

describe("RequireActiveCompany", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useSessionStore.setState({ accessToken: undefined, resolved: true });
		mockRouter();
		mockCompanies();
	});

	it("renders its children when the user has a company", () => {
		mockCompanies({ data: [company("c1", "Primera")] });

		render(
			<RequireActiveCompany>
				<p>Dashboard</p>
			</RequireActiveCompany>,
		);

		expect(screen.getByText("Dashboard")).toBeTruthy();
		expect(replace).not.toHaveBeenCalled();
	});

	it("sends a user with zero companies to /sin-empresas", () => {
		mockCompanies({ data: [] });

		render(
			<RequireActiveCompany>
				<p>Dashboard</p>
			</RequireActiveCompany>,
		);

		expect(replace).toHaveBeenCalledWith("/sin-empresas");
		expect(screen.queryByText("Dashboard")).toBeNull();
	});

	it("sends a 401 to /login", () => {
		mockCompanies({
			isError: true,
			error: new ApiError("No autorizado", 401),
		});

		render(
			<RequireActiveCompany>
				<p>Dashboard</p>
			</RequireActiveCompany>,
		);

		expect(replace).toHaveBeenCalledWith("/login");
		expect(screen.queryByText("Dashboard")).toBeNull();
	});

	it("waits for the session bootstrap before deciding on a 401", () => {
		useSessionStore.setState({ resolved: false });
		mockCompanies({
			isError: true,
			error: new ApiError("No autorizado", 401),
		});

		render(
			<RequireActiveCompany>
				<p>Dashboard</p>
			</RequireActiveCompany>,
		);

		expect(screen.getByLabelText("Cargando")).toBeTruthy();
		expect(screen.queryByText("Dashboard")).toBeNull();
		expect(replace).not.toHaveBeenCalled();
	});

	it("shows the loading state while the query is pending", () => {
		mockCompanies({ isPending: true });

		render(
			<RequireActiveCompany>
				<p>Dashboard</p>
			</RequireActiveCompany>,
		);

		expect(screen.getByLabelText("Cargando")).toBeTruthy();
		expect(screen.queryByText("Dashboard")).toBeNull();
		expect(replace).not.toHaveBeenCalled();
	});

	it("shows a message with a retry on a non-401 error", () => {
		const refetch = jest.fn();
		mockCompanies({
			isError: true,
			error: new ApiError("El servidor no respondió", 500),
			refetch,
		});

		render(
			<RequireActiveCompany>
				<p>Dashboard</p>
			</RequireActiveCompany>,
		);

		expect(screen.getByText("El servidor no respondió")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
		expect(refetch).toHaveBeenCalled();
		expect(replace).not.toHaveBeenCalled();
	});
});
