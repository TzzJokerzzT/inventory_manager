import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Customer, StockMovement } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useMovements } from "@/src/features/movement/api/use-movements";
import { useCreateCustomer } from "../api/use-create-customer";
import { useCustomer } from "../api/use-customer";
import { useCustomers } from "../api/use-customers";
import { useDeleteCustomer } from "../api/use-delete-customer";
import { useUpdateCustomer } from "../api/use-update-customer";
import { Client } from "../client";

jest.mock("@/src/features/company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(),
}));

jest.mock("../api/use-customers", () => ({
	useCustomers: jest.fn(),
}));

jest.mock("../api/use-customer", () => ({
	useCustomer: jest.fn(),
}));

jest.mock("../api/use-create-customer", () => ({
	useCreateCustomer: jest.fn(),
}));

jest.mock("../api/use-update-customer", () => ({
	useUpdateCustomer: jest.fn(),
}));

jest.mock("../api/use-delete-customer", () => ({
	useDeleteCustomer: jest.fn(),
}));

jest.mock("@/src/features/movement/api/use-movements", () => ({
	useMovements: jest.fn(),
}));

const useActiveCompanyMock = useActiveCompany as jest.MockedFunction<
	typeof useActiveCompany
>;
const useCustomersMock = useCustomers as jest.MockedFunction<
	typeof useCustomers
>;
const useCustomerMock = useCustomer as jest.MockedFunction<typeof useCustomer>;
const useCreateCustomerMock = useCreateCustomer as jest.MockedFunction<
	typeof useCreateCustomer
>;
const useUpdateCustomerMock = useUpdateCustomer as jest.MockedFunction<
	typeof useUpdateCustomer
>;
const useDeleteCustomerMock = useDeleteCustomer as jest.MockedFunction<
	typeof useDeleteCustomer
>;
const useMovementsMock = useMovements as jest.MockedFunction<
	typeof useMovements
>;

const deleteMutate = jest.fn();
const createMutate = jest.fn();
const updateMutate = jest.fn();

function customer(overrides: Partial<Customer> = {}): Customer {
	return {
		id: "cu1",
		companyId: "c1",
		name: "Distribuidora Pérez",
		email: "ventas@perez.com",
		phone: "+54 11 4321-9876",
		address: "Av. Siempre Viva 742",
		createdAt: "2026-10-22T12:00:00.000Z",
		updatedAt: "2026-10-22T12:00:00.000Z",
		...overrides,
	};
}

function sale(overrides: Partial<StockMovement> = {}): StockMovement {
	return {
		id: "m1",
		companyId: "c1",
		productId: "p1",
		type: "OUT",
		quantity: 4,
		reason: "Venta mostrador",
		createdAt: "2026-10-21T12:00:00.000Z",
		product: { id: "p1", name: "Café molido 500g", sku: "CAF-500" },
		actor: { id: "user-1", fullName: "Ana", email: "ana@empresa.com" },
		customerId: "cu1",
		customer: { id: "cu1", name: "Distribuidora Pérez" },
		// Fields the purchase-lot feature added to the contract: a legacy sale
		// carries no lot, no written price and no units.
		lotId: null,
		unitPrice: null,
		units: [],
		...overrides,
	};
}

function stubMutation(mutate = jest.fn()) {
	return {
		mutate,
		isPending: false,
		isError: false,
		error: undefined,
	};
}

function setup({
	rows = [customer()],
	customersState = {},
	detail = customer(),
	detailState = {},
}: {
	rows?: Customer[];
	customersState?: Record<string, unknown>;
	detail?: Customer;
	detailState?: Record<string, unknown>;
} = {}) {
	useActiveCompanyMock.mockReturnValue({
		id: "c1",
		name: "Empresa Uno",
		createdAt: "2026-10-06T00:00:00.000Z",
	});
	useCustomersMock.mockReturnValue({
		data: rows,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
		...customersState,
	} as unknown as ReturnType<typeof useCustomers>);
	useCustomerMock.mockReturnValue({
		data: detail,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
		...detailState,
	} as unknown as ReturnType<typeof useCustomer>);
	useCreateCustomerMock.mockReturnValue(
		stubMutation(createMutate) as unknown as ReturnType<
			typeof useCreateCustomer
		>,
	);
	useUpdateCustomerMock.mockReturnValue(
		stubMutation(updateMutate) as unknown as ReturnType<
			typeof useUpdateCustomer
		>,
	);
	useDeleteCustomerMock.mockReturnValue(
		stubMutation(deleteMutate) as unknown as ReturnType<
			typeof useDeleteCustomer
		>,
	);
	useMovementsMock.mockReturnValue({
		data: [sale()],
		isPending: false,
		isError: false,
		error: undefined,
	} as unknown as ReturnType<typeof useMovements>);
}

describe("Client", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("lists the real customers of the active company with contact data", () => {
		setup();

		render(<Client />);

		expect(useCustomersMock).toHaveBeenCalledWith("c1", "");
		expect(screen.getByRole("heading", { name: "Clientes" })).toBeTruthy();
		expect(screen.getByText("Distribuidora Pérez")).toBeTruthy();
		expect(screen.getByText("ventas@perez.com")).toBeTruthy();
		expect(screen.getByText("+54 11 4321-9876")).toBeTruthy();
		expect(screen.getByText("Av. Siempre Viva 742")).toBeTruthy();
	});

	it("shows the agreed columns and none that depend on CLI-04", () => {
		setup();

		render(<Client />);

		const headers = screen
			.getAllByRole("columnheader")
			.map((header) => header.textContent);

		expect(headers).toEqual([
			"Nombre",
			"Email",
			"Teléfono",
			"Dirección",
			"Acciones",
		]);
		expect(screen.queryByRole("columnheader", { name: "Compras" })).toBeNull();
		expect(screen.queryByRole("columnheader", { name: "Total" })).toBeNull();
	});

	it("shows a meaningful empty state", () => {
		setup({ rows: [] });

		render(<Client />);

		expect(screen.getByText(/Todavía no cargaste clientes/)).toBeTruthy();
	});

	it("searches and refreshes the query after the debounce", async () => {
		setup({ rows: [] });

		render(<Client />);

		fireEvent.change(screen.getByLabelText("Buscar clientes"), {
			target: { value: "perez" },
		});

		await waitFor(() => {
			expect(useCustomersMock).toHaveBeenLastCalledWith("c1", "perez");
		});
		expect(
			screen.getByText(/No encontramos clientes para «perez»/),
		).toBeTruthy();
	});

	it("shows the loading state while the list is being read", () => {
		setup({ customersState: { data: undefined, isPending: true } });

		render(<Client />);

		expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
	});

	it("shows an alert with the API message when the list cannot be read", () => {
		const error = new ApiError("No tenés acceso a esta empresa.", 403);
		setup({ customersState: { data: undefined, isError: true, error } });

		render(<Client />);

		expect(screen.getByText("No pudimos cargar los clientes")).toBeTruthy();
		expect(screen.getByText("No tenés acceso a esta empresa.")).toBeTruthy();
	});

	it("opens the creation form inline on the same page", () => {
		setup();

		render(<Client />);

		expect(screen.queryByLabelText("Nombre del cliente")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: /Nuevo Cliente/ }));

		expect(screen.getByLabelText("Nombre del cliente")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Crear cliente" })).toBeTruthy();
		// No route change: the mock used to link to /dashboard/products/create.
		expect(screen.queryByRole("link", { name: /Nuevo Cliente/ })).toBeNull();
	});

	it("closes the creation form when cancelled", () => {
		setup();

		render(<Client />);
		fireEvent.click(screen.getByRole("button", { name: /Nuevo Cliente/ }));
		fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(screen.queryByLabelText("Nombre del cliente")).toBeNull();
		expect(createMutate).not.toHaveBeenCalled();
	});

	it("opens the edit form prefilled from the stored customer", () => {
		setup();

		render(<Client />);
		fireEvent.click(screen.getByRole("button", { name: "Editar" }));

		expect(useCustomerMock).toHaveBeenCalledWith("c1", "cu1");
		expect(
			(screen.getByLabelText("Nombre del cliente") as HTMLInputElement).value,
		).toBe("Distribuidora Pérez");
		expect(
			screen.getByRole("button", { name: "Guardar cambios" }),
		).toBeTruthy();
	});

	it("explains that the customer to edit no longer exists", () => {
		setup({
			detail: undefined as unknown as Customer,
			detailState: {
				data: undefined,
				isError: true,
				error: new ApiError(
					"Ese cliente ya no existe en esta empresa.",
					404,
					"customer_not_found",
				),
			},
		});

		render(<Client />);
		fireEvent.click(screen.getByRole("button", { name: "Editar" }));

		expect(
			screen.getByText("Ese cliente ya no existe en esta empresa."),
		).toBeTruthy();
	});

	it("opens the detail of the selected customer on the same page", () => {
		setup();

		render(<Client />);

		expect(screen.queryByText("Detalle del cliente")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Detalle" }));

		expect(useMovementsMock).toHaveBeenCalledWith("c1", {
			customerId: "cu1",
			type: "OUT",
		});
		expect(
			screen.getByRole("heading", { name: "Detalle del cliente" }),
		).toBeTruthy();
		expect(screen.getByText("Café molido 500g")).toBeTruthy();
	});

	it("closes the detail and returns to the list", () => {
		setup();

		render(<Client />);
		fireEvent.click(screen.getByRole("button", { name: "Detalle" }));
		fireEvent.click(screen.getByRole("button", { name: "Volver al listado" }));

		expect(screen.queryByText("Detalle del cliente")).toBeNull();
		expect(screen.getByText("Distribuidora Pérez")).toBeTruthy();
		// El listado conserva sus acciones después de cerrar el detalle.
		expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
	});

	it("keeps only one panel open at a time", () => {
		setup();

		render(<Client />);

		fireEvent.click(screen.getByRole("button", { name: /Nuevo Cliente/ }));
		expect(screen.getByLabelText("Nombre del cliente")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Detalle" }));
		expect(screen.queryByLabelText("Nombre del cliente")).toBeNull();
		expect(
			screen.getByRole("heading", { name: "Detalle del cliente" }),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Editar" }));
		expect(screen.queryByText("Detalle del cliente")).toBeNull();
		expect(screen.getByLabelText("Nombre del cliente")).toBeTruthy();
	});

	it("deletes a customer only after the two-step confirmation", () => {
		setup();

		render(<Client />);
		fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

		expect(deleteMutate).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

		expect(deleteMutate).toHaveBeenCalledWith({ customerId: "cu1" });
	});

	it("invites the person to pick a company when there is none active", () => {
		setup();
		useActiveCompanyMock.mockReturnValue(undefined);

		render(<Client />);

		expect(
			screen.getByText("Seleccioná una empresa para ver sus clientes."),
		).toBeTruthy();
	});
});
