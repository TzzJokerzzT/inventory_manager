import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import type { Customer } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useMovements } from "@/src/features/movement/api/use-movements";
import { useCustomer } from "../api/use-customer";
import { ClientDetails } from "../client-details";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(),
}));

jest.mock("../api/use-customer", () => ({ useCustomer: jest.fn() }));
jest.mock("@/src/features/movement/api/use-movements", () => ({
	useMovements: jest.fn(),
}));

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const useActiveCompanyMock = useActiveCompany as jest.MockedFunction<
	typeof useActiveCompany
>;
const useCustomerMock = useCustomer as jest.MockedFunction<typeof useCustomer>;
const useMovementsMock = useMovements as jest.MockedFunction<
	typeof useMovements
>;

const push = jest.fn();

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
			: { ...company, createdAt: "2026-10-06T00:00:00.000Z" },
	);
	useCustomerMock.mockReturnValue({
		data: detail,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
		...detailState,
	} as unknown as ReturnType<typeof useCustomer>);
	useMovementsMock.mockReturnValue({
		data: [],
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useMovements>);
}

/**
 * The detail became a page, so this suite pins what the inline panel never had:
 * the read by id (a reload has to work) and the readable failure when the
 * customer is gone.
 */
describe("ClientDetails", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the customer of the route and shows the panel", () => {
		setup();

		render(<ClientDetails customerId="cu1" />);

		expect(useCustomerMock).toHaveBeenCalledWith("c1", "cu1");
		expect(
			screen.getByRole("heading", { name: "Detalle del cliente" }),
		).toBeTruthy();
		expect(screen.getAllByText("Distribuidora Pérez").length).toBeGreaterThan(
			0,
		);
	});

	it("reads the sales of that customer, not of the whole company", () => {
		setup();

		render(<ClientDetails customerId="cu1" />);

		expect(useMovementsMock).toHaveBeenCalledWith("c1", {
			customerId: "cu1",
			type: "OUT",
		});
	});

	it("offers the way back to the list", () => {
		setup();

		render(<ClientDetails customerId="cu1" />);

		expect(
			screen
				.getByRole("link", { name: /Volver al listado/i })
				.getAttribute("href"),
		).toBe("/dashboard/clients");
	});

	it("explains that the customer no longer exists", () => {
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

		render(<ClientDetails customerId="cu1" />);

		expect(screen.getByText("No pudimos cargar el cliente")).toBeTruthy();
		expect(
			screen.getByText("Ese cliente ya no existe en esta empresa."),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Volver a clientes" }));

		expect(push).toHaveBeenCalledWith("/dashboard/clients");
	});

	it("refuses to read anything without an active company", () => {
		setup({ company: null });

		render(<ClientDetails customerId="cu1" />);

		expect(screen.getByText("No hay una empresa activa")).toBeTruthy();
		expect(screen.queryByText("Detalle del cliente")).toBeNull();
	});
});
