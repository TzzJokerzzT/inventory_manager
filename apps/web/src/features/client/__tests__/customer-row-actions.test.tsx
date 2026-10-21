import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Customer } from "@/lib/api/schemas";
import { useDeleteCustomer } from "../api/use-delete-customer";
import { CustomerRowActions } from "../components/customer-row-actions";

jest.mock("../api/use-delete-customer", () => ({
	useDeleteCustomer: jest.fn(),
}));

const useDeleteCustomerMock = useDeleteCustomer as jest.MockedFunction<
	typeof useDeleteCustomer
>;

const deleteMutate = jest.fn();
const onEdit = jest.fn();

function stubMutation(state: Record<string, unknown> = {}) {
	return {
		mutate: deleteMutate,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	};
}

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

function renderActions() {
	return render(
		<CustomerRowActions companyId="c1" customer={customer()} onEdit={onEdit} />,
	);
}

describe("CustomerRowActions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useDeleteCustomerMock.mockReturnValue(
			stubMutation() as unknown as ReturnType<typeof useDeleteCustomer>,
		);
	});

	it("asks for confirmation before deleting anything", () => {
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

		expect(screen.getByText("¿Eliminar Distribuidora Pérez?")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
		expect(deleteMutate).not.toHaveBeenCalled();
	});

	it("deletes the customer only after the confirmation", () => {
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
		fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

		expect(deleteMutate).toHaveBeenCalledWith({ customerId: "cu1" });
	});

	it("cancels the confirmation without deleting", () => {
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
		fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
		expect(deleteMutate).not.toHaveBeenCalled();
	});

	it("opens the edit form for that customer", () => {
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Editar" }));

		expect(onEdit).toHaveBeenCalledWith(customer());
	});

	it("surfaces the API message when the deletion fails", () => {
		useDeleteCustomerMock.mockReturnValue(
			stubMutation({
				isError: true,
				error: new ApiError(
					"Ese cliente ya no existe en esta empresa.",
					404,
					"customer_not_found",
				),
			}) as unknown as ReturnType<typeof useDeleteCustomer>,
		);
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

		expect(
			screen.getByText("Ese cliente ya no existe en esta empresa."),
		).toBeTruthy();
	});
});
