import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type {
	Customer as CustomerModel,
	Product as ProductModel,
} from "@/lib/api/schemas";
import { useCustomers } from "@/src/features/client/api/use-customers";
import { useProducts } from "@/src/features/product/api/use-products";
import { useRegisterMovement } from "../api/use-register-movement";
import { MovementOutStockForm } from "../movement-stock-out-form";

jest.mock("@/src/features/product/api/use-products", () => ({
	useProducts: jest.fn(),
}));

jest.mock("@/src/features/client/api/use-customers", () => ({
	useCustomers: jest.fn(),
}));

jest.mock("../api/use-register-movement", () => ({
	useRegisterMovement: jest.fn(),
}));

const useProductsMock = useProducts as jest.MockedFunction<typeof useProducts>;
const useCustomersMock = useCustomers as jest.MockedFunction<
	typeof useCustomers
>;
const useRegisterMovementMock = useRegisterMovement as jest.MockedFunction<
	typeof useRegisterMovement
>;

function product(overrides: Partial<ProductModel> = {}): ProductModel {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		photoUrl: null,
		stockQuantity: 12,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

function customer(overrides: Partial<CustomerModel> = {}): CustomerModel {
	return {
		id: "cu1",
		companyId: "c1",
		name: "Almacén Sur",
		email: null,
		phone: null,
		address: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

const mutate = jest.fn();

function setup({
	catalogue = [product()],
	padron = [customer()],
	mutation = {},
}: {
	catalogue?: ProductModel[];
	padron?: CustomerModel[];
	mutation?: Record<string, unknown>;
} = {}) {
	useProductsMock.mockReturnValue({
		data: catalogue,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useProducts>);
	useCustomersMock.mockReturnValue({
		data: padron,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useCustomers>);
	useRegisterMovementMock.mockReturnValue({
		mutate,
		mutateAsync: mutate,
		isPending: false,
		isError: false,
		isSuccess: false,
		error: undefined,
		data: undefined,
		...mutation,
	} as unknown as ReturnType<typeof useRegisterMovement>);
}

/**
 * El combobox de Base UI abre con foco más teclado y confirma con el gesto de
 * puntero completo: ni un click suelto ni un `pointerDown` solo alcanzan.
 */
function choose(label: string, option: string) {
	const input = screen.getByLabelText(label);
	fireEvent.focus(input);
	fireEvent.keyDown(input, { key: "ArrowDown" });
	const item = screen.getByRole("option", { name: option });
	fireEvent.pointerDown(item);
	fireEvent.pointerUp(item);
	fireEvent.click(item);
}

function chooseProduct(label: string) {
	choose("Producto", label);
}

function chooseCustomer(label: string) {
	choose("Cliente", label);
}

function fill(label: string, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
	fireEvent.click(screen.getByRole("button", { name: "Registrar salida" }));
}

describe("MovementOutStockForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setup();
	});

	it("registers an OUT movement for the chosen product", () => {
		render(<MovementOutStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "2");
		fill("Motivo", "Venta");
		submit();

		expect(mutate).toHaveBeenCalledWith(
			{
				productId: "p1",
				type: "OUT",
				quantity: 2,
				reason: "Venta",
				customerId: null,
			},
			expect.any(Object),
		);
	});

	it("offers an optional customer selector fed by the real padrón", () => {
		render(<MovementOutStockForm companyId="c1" />);

		expect(useCustomersMock).toHaveBeenCalledWith("c1");

		const input = screen.getByLabelText("Cliente");
		fireEvent.focus(input);
		fireEvent.keyDown(input, { key: "ArrowDown" });

		// La opción explícita de "Sin cliente" es la que deja la venta anónima.
		expect(screen.getByRole("option", { name: "Sin cliente" })).toBeTruthy();
		expect(screen.getByRole("option", { name: "Almacén Sur" })).toBeTruthy();
	});

	it("sends the chosen customer with the sale", () => {
		render(<MovementOutStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "2");
		fill("Motivo", "Venta");
		chooseCustomer("Almacén Sur");
		submit();

		expect(mutate).toHaveBeenCalledWith(
			{
				productId: "p1",
				type: "OUT",
				quantity: 2,
				reason: "Venta",
				customerId: "cu1",
			},
			expect.any(Object),
		);
	});

	it("sends no customer as null when Sin cliente is chosen", () => {
		render(<MovementOutStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "2");
		chooseCustomer("Almacén Sur");
		chooseCustomer("Sin cliente");
		submit();

		expect(mutate).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: null }),
			expect.any(Object),
		);
	});

	it("shows the stock the API answered after the movement", () => {
		// El stock que se muestra es el de la respuesta (10), no el que la vista
		// podría calcular desde la caché del catálogo (12 - 2).
		setup({
			mutation: {
				isSuccess: true,
				data: {
					id: "m1",
					companyId: "c1",
					productId: "p1",
					type: "OUT",
					quantity: 2,
					reason: "Venta",
					createdAt: "2026-10-21T12:00:00.000Z",
					product: { id: "p1", name: "Café molido 500g", sku: "CAF-500" },
					actor: null,
					customerId: null,
					customer: null,
					stockQuantity: 10,
				},
			},
		});

		render(<MovementOutStockForm companyId="c1" />);

		expect(screen.getByText("Salida registrada")).toBeTruthy();
		expect(
			screen.getByText("2 unidades de Café molido 500g. Stock disponible: 10."),
		).toBeTruthy();
	});

	it("accepts a 201 that comes with the customer of the sale", () => {
		setup({
			mutation: {
				isSuccess: true,
				data: {
					id: "m1",
					companyId: "c1",
					productId: "p1",
					type: "OUT",
					quantity: 2,
					reason: "Venta",
					createdAt: "2026-10-21T12:00:00.000Z",
					product: { id: "p1", name: "Café molido 500g", sku: "CAF-500" },
					actor: null,
					customerId: "cu1",
					customer: { id: "cu1", name: "Almacén Sur" },
					stockQuantity: 9,
				},
			},
		});

		render(<MovementOutStockForm companyId="c1" />);

		expect(screen.getByText("Salida registrada")).toBeTruthy();
		expect(
			screen.getByText("2 unidades de Café molido 500g. Stock disponible: 9."),
		).toBeTruthy();
	});

	it("renders the customer_not_found message of the API", () => {
		setup({
			mutation: {
				isError: true,
				error: new ApiError("El cliente no existe.", 404, "customer_not_found"),
			},
		});

		render(<MovementOutStockForm companyId="c1" />);

		expect(
			screen.getByText("Ese cliente ya no existe en el padrón."),
		).toBeTruthy();
		expect(screen.queryByText("Salida registrada")).toBeNull();
	});

	it("renders the customer_requires_exit message of the API", () => {
		setup({
			mutation: {
				isError: true,
				error: new ApiError(
					"Una entrada no puede llevar cliente.",
					400,
					"customer_requires_exit",
				),
			},
		});

		render(<MovementOutStockForm companyId="c1" />);

		expect(
			screen.getByText(
				"Una entrada no puede llevar cliente: es una compra a proveedor, no una venta.",
			),
		).toBeTruthy();
	});

	it("resets the chosen customer after a successful registration", () => {
		mutate.mockImplementation((_input, options) =>
			options?.onSuccess?.({
				id: "m1",
				stockQuantity: 10,
			}),
		);

		render(<MovementOutStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "2");
		chooseCustomer("Almacén Sur");
		submit();

		expect((screen.getByLabelText("Cliente") as HTMLInputElement).value).toBe(
			"Sin cliente",
		);
	});
});
