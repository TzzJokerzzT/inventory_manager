import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import type { SupplierListItem } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useCreateProvider } from "../api/use-create-provider";
import { useProviders } from "../api/use-providers";
import { useUpdateProvider } from "../api/use-update-provider";
import { ProviderWrite } from "../provider-write";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(),
}));

jest.mock("../api/use-providers", () => ({ useProviders: jest.fn() }));
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
const useProvidersMock = useProviders as jest.MockedFunction<
	typeof useProviders
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
		lastLot: null,
		...overrides,
	};
}

function setup({
	rows = [provider()],
	providersState = {},
	company = { id: "c1", name: "Empresa Uno" },
}: {
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
		company === null
			? undefined
			: { ...company, createdAt: "2026-10-06T00:00:00.000Z" },
	);
	useProvidersMock.mockReturnValue({
		data: rows,
		isPending: false,
		isError: false,
		error: undefined,
		...providersState,
	} as unknown as ReturnType<typeof useProviders>);
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

/**
 * The write page replaced the inline panel. What it adds is the address: the
 * supplier is resolved from the roster by id, because the contract has no
 * per-supplier read, and an id that is not there has to say so instead of
 * offering an empty form that would create a duplicate.
 */
describe("ProviderWrite", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("offers the way back to the roster", () => {
		setup();

		render(<ProviderWrite />);

		expect(
			screen
				.getByRole("link", { name: /Volver a proveedores/ })
				.getAttribute("href"),
		).toBe("/dashboard/providers");
	});

	it("renders the empty form on the creation route", () => {
		setup();

		render(<ProviderWrite />);

		expect(
			screen.getByRole("heading", { level: 1, name: "Nuevo proveedor" }),
		).toBeTruthy();
		expect(screen.getByRole("form", { name: "Crear proveedor" })).toBeTruthy();
		expect(
			(screen.getByLabelText("Nombre del proveedor") as HTMLInputElement).value,
		).toBe("");
	});

	it("resolves the supplier from the roster on the edit route", () => {
		setup();

		render(<ProviderWrite providerId="su1" />);

		expect(useProvidersMock).toHaveBeenCalledWith("c1");
		expect(screen.getByRole("form", { name: "Editar proveedor" })).toBeTruthy();
		expect(
			(screen.getByLabelText("Nombre del proveedor") as HTMLInputElement).value,
		).toBe("Plásticos del Sur");
		expect((screen.getByLabelText("Contacto") as HTMLInputElement).value).toBe(
			"Ana Gómez · +54 11 4321-9876",
		);
	});

	it("explains that the supplier to edit is not in the roster", () => {
		setup({ rows: [provider({ id: "su1" })] });

		render(<ProviderWrite providerId="su-no-existe" />);

		expect(screen.getByText("No pudimos cargar el proveedor")).toBeTruthy();
		expect(
			screen.getByText("Ese proveedor ya no existe en esta empresa."),
		).toBeTruthy();
		expect(screen.queryByRole("form")).toBeNull();

		fireEvent.click(
			screen.getByRole("button", { name: "Volver a proveedores" }),
		);

		expect(push).toHaveBeenCalledWith("/dashboard/providers");
	});

	it("waits for the roster before deciding the supplier is missing", () => {
		setup({ providersState: { data: undefined, isPending: true } });

		render(<ProviderWrite providerId="su1" />);

		expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
		expect(screen.queryByText("No pudimos cargar el proveedor")).toBeNull();
	});

	it("returns to the roster when the form is cancelled", () => {
		setup();

		render(<ProviderWrite />);

		fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(push).toHaveBeenCalledWith("/dashboard/providers");
	});

	it("refuses to render the form without an active company", () => {
		setup({ company: null });

		render(<ProviderWrite />);

		expect(screen.getByText("No hay una empresa activa")).toBeTruthy();
		expect(screen.queryByRole("form")).toBeNull();
	});
});
