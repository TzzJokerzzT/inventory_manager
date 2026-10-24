import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import type { Customer } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useCreateCustomer } from "../api/use-create-customer";
import { useCustomer } from "../api/use-customer";
import { useUpdateCustomer } from "../api/use-update-customer";
import { ClientWrite } from "../client-write";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(),
}));

jest.mock("../api/use-customer", () => ({ useCustomer: jest.fn() }));
jest.mock("../api/use-create-customer", () => ({
	useCreateCustomer: jest.fn(),
}));
jest.mock("../api/use-update-customer", () => ({
	useUpdateCustomer: jest.fn(),
}));

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const useActiveCompanyMock = useActiveCompany as jest.MockedFunction<
	typeof useActiveCompany
>;
const useCustomerMock = useCustomer as jest.MockedFunction<typeof useCustomer>;
const useCreateCustomerMock = useCreateCustomer as jest.MockedFunction<
	typeof useCreateCustomer
>;
const useUpdateCustomerMock = useUpdateCustomer as jest.MockedFunction<
	typeof useUpdateCustomer
>;

const push = jest.fn();
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

/**
 * The write page replaced the inline panel, so what this suite pins is the part
 * the panel did not have: an address, a way back to the list, and the edit read
 * with its own failure path.
 */
function setup({
	detail = customer(),
	detailState = {},
	company = { id: "c1", name: "Empresa Uno" },
}: {
	detail?: Customer;
	detailState?: Record<string, unknown>;
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
			: {
					...company,
					createdAt: "2026-10-06T00:00:00.000Z",
				},
	);
	useCustomerMock.mockReturnValue({
		data: detail,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
		...detailState,
	} as unknown as ReturnType<typeof useCustomer>);
	useCreateCustomerMock.mockReturnValue({
		mutate: createMutate,
		isPending: false,
		isError: false,
		error: undefined,
	} as unknown as ReturnType<typeof useCreateCustomer>);
	useUpdateCustomerMock.mockReturnValue({
		mutate: updateMutate,
		isPending: false,
		isError: false,
		error: undefined,
	} as unknown as ReturnType<typeof useUpdateCustomer>);
}

describe("ClientWrite", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("offers the way back to the list", () => {
		setup();

		render(<ClientWrite />);

		expect(
			screen
				.getByRole("link", { name: /Volver a clientes/ })
				.getAttribute("href"),
		).toBe("/dashboard/clients");
	});

	it("renders the empty form for the creation route", () => {
		setup();

		render(<ClientWrite />);

		expect(
			screen.getByRole("heading", { level: 1, name: "Nuevo cliente" }),
		).toBeTruthy();
		expect(
			(screen.getByLabelText("Nombre del cliente") as HTMLInputElement).value,
		).toBe("");
		// Creating needs no read: the page never asks for a customer.
		expect(useCustomerMock).toHaveBeenCalledWith("c1", undefined);
	});

	it("reads the customer and prefills the form on the edit route", () => {
		setup();

		render(<ClientWrite customerId="cu1" />);

		expect(useCustomerMock).toHaveBeenCalledWith("c1", "cu1");
		expect(
			screen.getByRole("heading", { level: 1, name: "Editar cliente" }),
		).toBeTruthy();
		expect(
			(screen.getByLabelText("Nombre del cliente") as HTMLInputElement).value,
		).toBe("Distribuidora Pérez");
	});

	it("explains that the customer to edit no longer exists", () => {
		setup({
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

		render(<ClientWrite customerId="cu1" />);

		expect(screen.getByText("No pudimos cargar el cliente")).toBeTruthy();
		// The way out is the same as anywhere else on the page: back to the list.
		expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
	});

	it("returns to the list when the form is cancelled", () => {
		setup();

		render(<ClientWrite />);

		fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(push).toHaveBeenCalledWith("/dashboard/clients");
		expect(createMutate).not.toHaveBeenCalled();
	});

	it("refuses to render the form without an active company", () => {
		setup({ company: null });

		render(<ClientWrite />);

		expect(screen.getByText("No hay una empresa activa")).toBeTruthy();
		expect(screen.queryByLabelText("Nombre del cliente")).toBeNull();
	});
});
