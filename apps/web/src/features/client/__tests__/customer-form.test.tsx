import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Customer } from "@/lib/api/schemas";
import { useCreateCustomer } from "../api/use-create-customer";
import { useUpdateCustomer } from "../api/use-update-customer";
import { CustomerForm } from "../components/customer-form";

jest.mock("../api/use-create-customer", () => ({
	useCreateCustomer: jest.fn(),
}));

jest.mock("../api/use-update-customer", () => ({
	useUpdateCustomer: jest.fn(),
}));

// The form now resolves the active company itself instead of taking it as a
// prop, so the suite provides one instead of a QueryClient.
jest.mock("../../company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(() => ({
		id: "c1",
		name: "Empresa Uno",
		createdAt: "2026-10-06T00:00:00.000Z",
	})),
}));

const useCreateCustomerMock = useCreateCustomer as jest.MockedFunction<
	typeof useCreateCustomer
>;
const useUpdateCustomerMock = useUpdateCustomer as jest.MockedFunction<
	typeof useUpdateCustomer
>;

const createMutate = jest.fn();
const updateMutate = jest.fn();
const onSaved = jest.fn();
const onCancel = jest.fn();

/**
 * The real mutation calls `onSuccess` on success; the stub resumes that contract
 * so the form's "close the panel after saving" path is exercised too.
 */
function stubMutation(mutate: jest.Mock, state: Record<string, unknown> = {}) {
	return {
		mutate: jest.fn((body, options?: { onSuccess?: () => void }) => {
			mutate(body, options);
			options?.onSuccess?.();
		}),
		mutateAsync: mutate,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	};
}

function mockHooks(
	state: {
		create?: Record<string, unknown>;
		update?: Record<string, unknown>;
	} = {},
) {
	useCreateCustomerMock.mockReturnValue(
		stubMutation(createMutate, state.create) as unknown as ReturnType<
			typeof useCreateCustomer
		>,
	);
	useUpdateCustomerMock.mockReturnValue(
		stubMutation(updateMutate, state.update) as unknown as ReturnType<
			typeof useUpdateCustomer
		>,
	);
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

function fill(label: string, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit(label: string) {
	fireEvent.click(screen.getByRole("button", { name: label }));
}

function renderCreate() {
	return render(<CustomerForm onSaved={onSaved} onCancel={onCancel} />);
}

function renderEdit(value: Customer = customer()) {
	return render(
		<CustomerForm customer={value} onSaved={onSaved} onCancel={onCancel} />,
	);
}

describe("CustomerForm (create)", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockHooks();
	});

	it("reports the required name without calling the API", () => {
		renderCreate();

		submit("Crear cliente");

		expect(screen.getByText("Ingresá el nombre del cliente.")).toBeTruthy();
		expect(createMutate).not.toHaveBeenCalled();
	});

	it("rejects the contact data the API would reject", () => {
		renderCreate();
		fill("Nombre del cliente", "Distribuidora Pérez");
		fill("Email", "cliente@");
		fill("Teléfono", "4321-ABCD");

		submit("Crear cliente");

		expect(
			screen.getByText(
				"Ingresá un email válido, por ejemplo cliente@empresa.com.",
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				"Usá sólo números y los signos + - ( ) . en el teléfono.",
			),
		).toBeTruthy();
		expect(createMutate).not.toHaveBeenCalled();
	});

	it("creates the customer with the normalized values and closes the panel", () => {
		renderCreate();
		fill("Nombre del cliente", "  Distribuidora Pérez  ");
		fill("Email", "  Ventas@Perez.COM  ");
		fill("Teléfono", "  +54 11 4321-9876  ");
		fill("Dirección", "  Av. Siempre Viva 742  ");

		submit("Crear cliente");

		expect(createMutate).toHaveBeenCalledWith(
			{
				name: "Distribuidora Pérez",
				email: "ventas@perez.com",
				phone: "+54 11 4321-9876",
				address: "Av. Siempre Viva 742",
			},
			expect.any(Object),
		);
		expect(onSaved).toHaveBeenCalled();
	});

	it("sends the optional contact fields as null when they are blank", () => {
		renderCreate();
		fill("Nombre del cliente", "Distribuidora Pérez");

		submit("Crear cliente");

		expect(createMutate).toHaveBeenCalledWith(
			{
				name: "Distribuidora Pérez",
				email: null,
				phone: null,
				address: null,
			},
			expect.any(Object),
		);
	});

	it("blocks the fields and the submit while the creation is in flight", () => {
		mockHooks({ create: { isPending: true } });

		renderCreate();

		expect(
			screen.getByRole("button", { name: /Creando/ }).hasAttribute("disabled"),
		).toBe(true);
		expect(
			screen.getByLabelText("Nombre del cliente").hasAttribute("disabled"),
		).toBe(true);
	});

	it("surfaces the API message when the creation fails", () => {
		mockHooks({
			create: {
				isError: true,
				error: new ApiError("No tenés acceso a esta empresa.", 403),
			},
		});

		renderCreate();

		expect(screen.getByText("No tenés acceso a esta empresa.")).toBeTruthy();
	});

	it("returns to the list without calling the API when cancelled", () => {
		renderCreate();
		fill("Nombre del cliente", "Distribuidora Pérez");

		fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(onCancel).toHaveBeenCalled();
		expect(createMutate).not.toHaveBeenCalled();
	});
});

describe("CustomerForm (edit)", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockHooks();
	});

	it("prefills the form with the customer being edited", () => {
		renderEdit();

		expect(
			(screen.getByLabelText("Nombre del cliente") as HTMLInputElement).value,
		).toBe("Distribuidora Pérez");
		expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
			"ventas@perez.com",
		);
		expect((screen.getByLabelText("Teléfono") as HTMLInputElement).value).toBe(
			"+54 11 4321-9876",
		);
		expect(
			(screen.getByLabelText("Dirección") as HTMLTextAreaElement).value,
		).toBe("Av. Siempre Viva 742");
	});

	it("prefills an empty contact field as an empty input, not the text null", () => {
		renderEdit(customer({ email: null, phone: null, address: null }));

		expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
		expect(
			(screen.getByLabelText("Dirección") as HTMLTextAreaElement).value,
		).toBe("");
	});

	it("patches the customer, sending a cleared field as null", () => {
		renderEdit();
		fill("Teléfono", "   ");

		submit("Guardar cambios");

		expect(updateMutate).toHaveBeenCalledWith(
			{
				customerId: "cu1",
				name: "Distribuidora Pérez",
				email: "ventas@perez.com",
				phone: null,
				address: "Av. Siempre Viva 742",
			},
			expect.any(Object),
		);
		expect(onSaved).toHaveBeenCalled();
	});

	it("reports customer_not_found as a readable message", () => {
		mockHooks({
			update: {
				isError: true,
				error: new ApiError("Not found", 404, "customer_not_found"),
			},
		});

		renderEdit();

		expect(
			screen.getByText("Ese cliente ya no existe en esta empresa."),
		).toBeTruthy();
	});
});
