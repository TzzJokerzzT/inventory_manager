import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import type { SupplierListItem } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useMe } from "@/src/features/user/api/use-me";
import { useCreateProvider } from "../api/use-create-provider";
import { useDeleteProvider } from "../api/use-delete-provider";
import { useProviders } from "../api/use-providers";
import { useUpdateProvider } from "../api/use-update-provider";
import { Providers } from "../providers";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(),
}));

jest.mock("@/src/features/user/api/use-me", () => ({
	useMe: jest.fn(),
}));

jest.mock("../api/use-providers", () => ({
	useProviders: jest.fn(),
}));

jest.mock("../api/use-delete-provider", () => ({
	useDeleteProvider: jest.fn(),
}));

jest.mock("../api/use-create-provider", () => ({
	useCreateProvider: jest.fn(),
}));

jest.mock("../api/use-update-provider", () => ({
	useUpdateProvider: jest.fn(),
}));

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const useActiveCompanyMock = useActiveCompany as jest.MockedFunction<
	typeof useActiveCompany
>;
const useMeMock = useMe as jest.MockedFunction<typeof useMe>;
const useProvidersMock = useProviders as jest.MockedFunction<
	typeof useProviders
>;
const useDeleteProviderMock = useDeleteProvider as jest.MockedFunction<
	typeof useDeleteProvider
>;

const push = jest.fn();

function provider(overrides: Partial<SupplierListItem> = {}): SupplierListItem {
	return {
		id: "su1",
		companyId: "c1",
		name: "Plásticos del Sur",
		contact: "Ana Gómez · +54 11 4321-9876",
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		lastLot: {
			id: "lot1",
			productId: "p1",
			productName: "Rollo de polietileno",
			costPerMeasure: "5900.00",
			measureUnit: "KILOGRAM",
			receivedAt: "2026-10-22T12:00:00.000Z",
		},
		...overrides,
	};
}

function setup({
	role = "OWNER",
	rows = [provider()],
	providersState = {},
	company = { id: "c1", name: "Empresa Uno" },
}: {
	role?: "OWNER" | "ADMIN" | "MEMBER";
	rows?: SupplierListItem[];
	providersState?: Record<string, unknown>;
	company?: { id: string; name: string } | null;
} = {}) {
	useRouterMock.mockReturnValue({
		push,
		replace: jest.fn(),
		refresh: jest.fn(),
		back: jest.fn(),
		forward: jest.fn(),
		prefetch: jest.fn(),
	} as unknown as ReturnType<typeof useRouter>);
	useActiveCompanyMock.mockReturnValue(
		company
			? {
					...company,
					createdAt: "2026-10-06T00:00:00.000Z",
				}
			: undefined,
	);
	useMeMock.mockReturnValue({
		data: {
			id: "user-1",
			email: "ana@empresa.com",
			fullName: "Ana Pérez",
			createdAt: "2026-10-06T00:00:00.000Z",
			memberships: [
				{
					companyId: "c1",
					role,
					company: {
						id: "c1",
						name: "Empresa Uno",
						createdAt: "2026-10-06T00:00:00.000Z",
					},
				},
			],
		},
		isPending: false,
		isError: false,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useMe>);
	useProvidersMock.mockReturnValue({
		data: rows,
		isPending: false,
		isError: false,
		error: undefined,
		...providersState,
	} as unknown as ReturnType<typeof useProviders>);
	useDeleteProviderMock.mockReturnValue({
		mutate: jest.fn(),
		isPending: false,
		isError: false,
		error: undefined,
	} as unknown as ReturnType<typeof useDeleteProvider>);
	// The form is mocked at the hook level, like the rest of the view: the
	// roster test is about which actions are offered, not about saving.
	(useCreateProvider as jest.Mock).mockReturnValue({
		mutate: jest.fn(),
		isPending: false,
		isError: false,
		error: undefined,
	});
	(useUpdateProvider as jest.Mock).mockReturnValue({
		mutate: jest.fn(),
		isPending: false,
		isError: false,
		error: undefined,
	});
}

describe("Providers", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("lists the roster of the active company with the last lot's price per measure", () => {
		setup();

		render(<Providers />);

		expect(useProvidersMock).toHaveBeenCalledWith("c1");
		expect(screen.getByRole("heading", { name: "Proveedores" })).toBeTruthy();
		expect(screen.getByText("Plásticos del Sur")).toBeTruthy();
		expect(screen.getByText("Ana Gómez · +54 11 4321-9876")).toBeTruthy();
		// The decimal string is formatted, never parsed as a float.
		expect(screen.getByText("$ 5.900,00 por kg")).toBeTruthy();
	});

	it("shows a supplier that was never bought from without inventing a lot", () => {
		setup({ rows: [provider({ contact: null, lastLot: null })] });

		render(<Providers />);

		expect(screen.getByText("Sin compras")).toBeTruthy();
		expect(screen.getByText("—")).toBeTruthy();
	});

	it("shows a meaningful empty state", () => {
		setup({ rows: [] });

		render(<Providers />);

		expect(screen.getByText(/Todavía no cargaste proveedores/)).toBeTruthy();
	});

	it("asks for an active company instead of calling the API without one", () => {
		setup({ company: null });

		render(<Providers />);

		expect(screen.getByText(/Seleccioná una empresa/)).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: /Nuevo Proveedor/ }),
		).toBeNull();
	});

	it("shows the loading state while the roster is being read", () => {
		setup({ providersState: { data: undefined, isPending: true } });

		render(<Providers />);

		expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
	});

	it("shows an alert with the API message when the roster cannot be read", () => {
		const error = new ApiError("No tenés acceso a esta empresa.", 403);
		setup({ providersState: { data: undefined, isError: true, error } });

		render(<Providers />);

		expect(screen.getByText("No pudimos cargar los proveedores")).toBeTruthy();
		expect(screen.getByText("No tenés acceso a esta empresa.")).toBeTruthy();
	});

	it("does not offer any write action to a MEMBER", () => {
		setup({ role: "MEMBER" });

		render(<Providers />);

		// The roster is context for registering a purchase, so a MEMBER reads it.
		expect(screen.getByText("Plásticos del Sur")).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: /Nuevo Proveedor/ }),
		).toBeNull();
		expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull();
		expect(screen.queryByRole("columnheader", { name: "Acciones" })).toBeNull();
	});

	it("offers the write actions to an ADMIN", () => {
		setup({ role: "ADMIN" });

		render(<Providers />);

		expect(
			screen.getByRole("button", { name: /Nuevo Proveedor/ }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Eliminar" })).toBeTruthy();
	});

	it("navigates to the edit route of the chosen supplier", () => {
		setup({
			rows: [
				provider({ id: "su1", name: "Plásticos del Sur" }),
				provider({ id: "su2", name: "Rollo Norte", contact: null }),
			],
		});

		render(<Providers />);

		fireEvent.click(
			screen.getAllByRole("button", { name: "Editar" })[1] as HTMLElement,
		);

		expect(push).toHaveBeenCalledWith("/dashboard/providers/su2/edit");
		// The form lives on its own page now: the roster opens nothing.
		expect(screen.queryByLabelText("Nombre del proveedor")).toBeNull();
	});

	it("navigates to the create route from the header button", () => {
		setup();

		render(<Providers />);

		fireEvent.click(screen.getByRole("button", { name: /Nuevo Proveedor/ }));

		expect(push).toHaveBeenCalledWith("/dashboard/providers/create");
		expect(screen.queryByRole("form", { name: "Crear proveedor" })).toBeNull();
	});
});
