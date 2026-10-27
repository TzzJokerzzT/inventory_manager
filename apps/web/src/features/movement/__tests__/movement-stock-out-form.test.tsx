import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type {
	Customer as CustomerModel,
	Product as ProductModel,
	ProductUnit as ProductUnitModel,
} from "@/lib/api/schemas";
import { useCustomers } from "@/src/features/client/api/use-customers";
import { useProductUnits } from "@/src/features/lot/api/use-product-units";
import { useProducts } from "@/src/features/product/api/use-products";
import { AlertToast } from "@/src/shared/components/AlertToast";
import { useRegisterMovement } from "../api/use-register-movement";
import { MovementOutStockForm } from "../movement-stock-out-form";

jest.mock("@/src/features/product/api/use-products", () => ({
	useProducts: jest.fn(),
}));

/**
 * La fila del catálogo lleva `availableUnits` (L25): es lo que la pantalla de
 * salida mira para decidir si la venta pide unidades o una cantidad suelta.
 */
type ProductRow = ProductModel & { availableUnits: number };

jest.mock("@/src/features/lot/api/use-product-units", () => ({
	useProductUnits: jest.fn(),
}));

jest.mock("@/src/features/client/api/use-customers", () => ({
	useCustomers: jest.fn(),
}));

jest.mock("../api/use-register-movement", () => ({
	useRegisterMovement: jest.fn(),
}));

// El formulario compartido también monta el bloque de compra: se mockea su hook
// para no necesitar un QueryClient en esta suite.
jest.mock("@/src/features/lot/api/use-register-lot", () => ({
	useRegisterLot: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));

jest.mock("@/src/shared/components/AlertToast", () => ({
	AlertToast: jest.fn(),
}));

const useProductsMock = useProducts as jest.MockedFunction<typeof useProducts>;
const useCustomersMock = useCustomers as jest.MockedFunction<
	typeof useCustomers
>;
const useProductUnitsMock = useProductUnits as jest.MockedFunction<
	typeof useProductUnits
>;
const useRegisterMovementMock = useRegisterMovement as jest.MockedFunction<
	typeof useRegisterMovement
>;

function product(overrides: Partial<ProductRow> = {}): ProductRow {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		measureUnit: "KILOGRAM",
		photoUrl: null,
		stockQuantity: 12,
		lowStockThreshold: 0,
		categoryId: null,
		categoryName: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		availableUnits: 0,
		...overrides,
	};
}

function unit(overrides: Partial<ProductUnitModel> = {}): ProductUnitModel {
	return {
		id: "u1",
		code: "R-01",
		measure: "12.500",
		cost: "73750.00",
		status: "AVAILABLE",
		lotId: "lo1",
		receivedAt: "2026-10-23T12:00:00.000Z",
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

const alertToastMock = AlertToast as jest.MockedFunction<typeof AlertToast>;
const mutate = jest.fn();

function setup({
	catalogue = [product()],
	padron = [customer()],
	mutation = {},
	units = [],
	unitsState = {},
}: {
	catalogue?: ProductRow[];
	padron?: CustomerModel[];
	mutation?: Record<string, unknown>;
	units?: ProductUnitModel[];
	unitsState?: Record<string, unknown>;
} = {}) {
	useProductsMock.mockReturnValue({
		data: catalogue,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useProducts>);
	useProductUnitsMock.mockReturnValue({
		data: units,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
		...unitsState,
	} as unknown as ReturnType<typeof useProductUnits>);
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

	it("surfaces the stock the API answered after the movement in the success toast", () => {
		// El stock del toast es el de la respuesta de la transacción (10), no el
		// que la vista podría calcular desde la caché del catálogo (12 - 2).
		mutate.mockImplementation((_input, options) =>
			options?.onSuccess?.({ id: "m1", stockQuantity: 10 }),
		);

		render(<MovementOutStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "2");
		submit();

		expect(alertToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "success",
				description: "Salida registrada. Stock disponible: 10.",
			}),
		);
	});

	it("accepts a 201 that comes with the customer of the sale", () => {
		mutate.mockImplementation((_input, options) =>
			options?.onSuccess?.({
				id: "m1",
				customerId: "cu1",
				customer: { id: "cu1", name: "Almacén Sur" },
				stockQuantity: 9,
			}),
		);

		render(<MovementOutStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "2");
		chooseCustomer("Almacén Sur");
		submit();

		expect(alertToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "success",
				description: "Salida registrada. Stock disponible: 9.",
			}),
		);
		expect(mutate).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cu1" }),
			expect.any(Object),
		);
	});

	it("surfaces the customer_not_found message of the API in the error toast", () => {
		mutate.mockImplementation((_input, options) =>
			options?.onError?.(
				new ApiError("El cliente no existe.", 404, "customer_not_found"),
			),
		);

		render(<MovementOutStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "2");
		submit();

		expect(alertToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "error",
				description: "Ese cliente ya no existe en el padrón.",
			}),
		);
		expect(alertToastMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "success" }),
		);
	});

	it("surfaces the customer_requires_exit message of the API in the error toast", () => {
		mutate.mockImplementation((_input, options) =>
			options?.onError?.(
				new ApiError(
					"Una entrada no puede llevar cliente.",
					400,
					"customer_requires_exit",
				),
			),
		);

		render(<MovementOutStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "2");
		submit();

		expect(alertToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "error",
				description:
					"Una entrada no puede llevar cliente: es una compra a proveedor, no una venta.",
			}),
		);
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

	it("keeps a product without units on the loose sale it always was", () => {
		// Regresión pineada (L24): sin unidades disponibles no hay lista, no hay
		// precio escrito y la cantidad se sigue escribiendo a mano.
		setup({ catalogue: [product({ availableUnits: 0 })] });

		render(<MovementOutStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");

		expect(screen.queryByLabelText("Precio de venta")).toBeNull();
		expect(screen.queryByText(/unidades$/)).toBeNull();
		expect(
			(screen.getByLabelText("Cantidad") as HTMLInputElement).disabled,
		).toBe(false);

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
		// Sin unidades no se lee la lista de unidades del producto.
		expect(useProductUnitsMock).toHaveBeenCalledWith("c1", undefined);
	});

	it("sells the chosen units with the price written on the sale", () => {
		setup({
			catalogue: [product({ availableUnits: 2, price: "1500.00" })],
			units: [
				unit({ id: "u1", code: "R-01" }),
				unit({ id: "u2", code: "R-02", measure: "13.000", cost: "76700.00" }),
			],
		});

		render(<MovementOutStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");

		// La lista se pide para el producto elegido, y sólo entonces.
		expect(useProductUnitsMock).toHaveBeenCalledWith("c1", "p1");

		// El precio de venta se precarga con el de lista (L25) y es editable.
		const price = screen.getByLabelText("Precio de venta") as HTMLInputElement;
		expect(price.value).toBe("1500.00");

		// La cantidad se deriva de las unidades: el campo está deshabilitado.
		const quantity = screen.getByLabelText("Cantidad") as HTMLInputElement;
		expect(quantity.disabled).toBe(true);
		expect(quantity.value).toBe("0");

		fireEvent.click(screen.getByLabelText(/R-01/));
		expect(quantity.value).toBe("1");
		fireEvent.click(screen.getByLabelText(/R-02/));
		expect(quantity.value).toBe("2");
		expect(screen.getByText("2 de 2 unidades")).toBeTruthy();

		fill("Precio de venta", "1800.50");
		submit();

		expect(mutate).toHaveBeenCalledWith(
			{
				productId: "p1",
				type: "OUT",
				quantity: 2,
				reason: null,
				customerId: null,
				unitIds: ["u1", "u2"],
				unitPrice: "1800.50",
			},
			expect.any(Object),
		);
	});

	it("blocks a sale with no unit selected and calls nothing", () => {
		setup({
			catalogue: [product({ availableUnits: 1 })],
			units: [unit({ id: "u1", code: "R-01" })],
		});

		render(<MovementOutStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");
		submit();

		expect(mutate).not.toHaveBeenCalled();
		expect(
			screen.getByText("Elegí al menos una unidad para la venta."),
		).toBeTruthy();
	});

	it("requires a written price above zero, with up to two decimals", () => {
		setup({
			catalogue: [product({ availableUnits: 1 })],
			units: [unit({ id: "u1", code: "R-01" })],
		});

		render(<MovementOutStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");
		fireEvent.click(screen.getByLabelText(/R-01/));
		fill("Precio de venta", "1.234");
		submit();

		expect(mutate).not.toHaveBeenCalled();
		expect(
			screen.getByText("Usá un precio mayor que cero, con hasta 2 decimales."),
		).toBeTruthy();
	});

	it("clears the chosen units after a successful sale", () => {
		setup({
			catalogue: [product({ availableUnits: 1 })],
			units: [unit({ id: "u1", code: "R-01" })],
		});
		mutate.mockImplementation((_input, options) =>
			options?.onSuccess?.({ id: "m1", stockQuantity: 11 }),
		);

		render(<MovementOutStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");
		fireEvent.click(screen.getByLabelText(/R-01/));
		submit();

		expect((screen.getByLabelText("Producto") as HTMLInputElement).value).toBe(
			"",
		);
		expect(
			(screen.getByLabelText("Cantidad") as HTMLInputElement).disabled,
		).toBe(false);
	});

	it("surfaces unit_not_available in Spanish", () => {
		setup({
			catalogue: [product({ availableUnits: 1 })],
			units: [unit({ id: "u1", code: "R-01" })],
		});
		mutate.mockImplementation((_input, options) =>
			options?.onError?.(
				new ApiError("The unit is not available.", 409, "unit_not_available"),
			),
		);

		render(<MovementOutStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");
		fireEvent.click(screen.getByLabelText(/R-01/));
		submit();

		expect(alertToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "error",
				description:
					"Alguna de las unidades elegidas ya se vendió. Actualizá la lista y volvé a elegir.",
			}),
		);
		expect(alertToastMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "success" }),
		);
	});

	it("surfaces units_required in Spanish", () => {
		mutate.mockImplementation((_input, options) =>
			options?.onError?.(new ApiError("units required", 400, "units_required")),
		);

		render(<MovementOutStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "1");
		submit();

		expect(alertToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "error",
				description: "Elegí las unidades de la venta y escribí el precio.",
			}),
		);
	});
});
