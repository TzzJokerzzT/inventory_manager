import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Product as ProductModel } from "@/lib/api/schemas";
import { useCustomers } from "@/src/features/client/api/use-customers";
import { useProducts } from "@/src/features/product/api/use-products";
import { useRegisterMovement } from "../api/use-register-movement";
import { MovementEntryStockForm } from "../movement-stock-entry-form";

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
		stockQuantity: 8,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

const mutate = jest.fn();

function setup({
	catalogue = [product()],
	mutation = {},
}: {
	catalogue?: ProductModel[];
	mutation?: Record<string, unknown>;
} = {}) {
	useProductsMock.mockReturnValue({
		data: catalogue,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useProducts>);
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
function chooseProduct(label: string) {
	const input = screen.getByLabelText("Producto");
	fireEvent.focus(input);
	fireEvent.keyDown(input, { key: "ArrowDown" });
	const option = screen.getByRole("option", { name: label });
	fireEvent.pointerDown(option);
	fireEvent.pointerUp(option);
	fireEvent.click(option);
}

function fill(label: string, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit(label = "Registrar entrada") {
	fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("MovementEntryStockForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setup();
	});

	it("offers the catalogue as name and SKU, and sends the product id", () => {
		render(<MovementEntryStockForm companyId="c1" />);

		fireEvent.focus(screen.getByLabelText("Producto"));
		fireEvent.keyDown(screen.getByLabelText("Producto"), { key: "ArrowDown" });

		expect(
			screen.getByRole("option", { name: "Café molido 500g · CAF-500" }),
		).toBeTruthy();
		expect(useProductsMock).toHaveBeenCalledWith("c1");
	});

	it("never offers the customer selector: an entry is a purchase, not a sale", () => {
		render(<MovementEntryStockForm companyId="c1" />);

		expect(screen.queryByLabelText("Cliente")).toBeNull();
		// Tampoco se lee el padrón: la entrada no puede llevar cliente (S2).
		expect(useCustomersMock).not.toHaveBeenCalled();
	});

	it("registers an IN movement with the chosen product, quantity and reason", () => {
		render(<MovementEntryStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "10");
		fill("Motivo", "  Compra a proveedor  ");
		submit();

		expect(mutate).toHaveBeenCalledWith(
			{
				productId: "p1",
				type: "IN",
				quantity: 10,
				reason: "Compra a proveedor",
			},
			expect.any(Object),
		);
	});

	it("sends a blank reason as null", () => {
		render(<MovementEntryStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "3");
		submit();

		expect(mutate).toHaveBeenCalledWith(
			{ productId: "p1", type: "IN", quantity: 3, reason: null },
			expect.any(Object),
		);
	});

	it("blocks the submit when no product was chosen", () => {
		render(<MovementEntryStockForm companyId="c1" />);

		fill("Cantidad", "10");
		submit();

		expect(screen.getByText("Seleccioná un producto.")).toBeTruthy();
		expect(mutate).not.toHaveBeenCalled();
	});

	it("blocks the submit when the quantity is not a positive integer", () => {
		render(<MovementEntryStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		submit();
		expect(screen.getByText("Ingresá la cantidad.")).toBeTruthy();

		fill("Cantidad", "0");
		submit();
		expect(
			screen.getByText("Usá una cantidad entre 1 y 1.000.000."),
		).toBeTruthy();

		fill("Cantidad", "2.5");
		submit();
		expect(
			screen.getByText("Usá una cantidad entera, por ejemplo 10."),
		).toBeTruthy();

		expect(mutate).not.toHaveBeenCalled();
	});

	it("renders the API message of insufficient_stock instead of a success", () => {
		setup({
			mutation: {
				isError: true,
				error: new ApiError(
					"No hay stock suficiente: disponible 3.",
					409,
					"insufficient_stock",
				),
			},
		});

		render(<MovementEntryStockForm companyId="c1" />);

		expect(
			screen.getByText("No hay stock suficiente: disponible 3."),
		).toBeTruthy();
		expect(screen.queryByText("Entrada registrada")).toBeNull();
	});

	it("resets the form after a successful registration", () => {
		mutate.mockImplementation((_input, options) =>
			options?.onSuccess?.({
				id: "m1",
				stockQuantity: 18,
			}),
		);

		render(<MovementEntryStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "10");
		fill("Motivo", "Compra a proveedor");
		submit();

		expect((screen.getByLabelText("Cantidad") as HTMLInputElement).value).toBe(
			"",
		);
		expect((screen.getByLabelText("Motivo") as HTMLInputElement).value).toBe(
			"",
		);
		expect((screen.getByLabelText("Producto") as HTMLInputElement).value).toBe(
			"",
		);
	});

	it("blocks the fields and the submit while the registration is in flight", () => {
		setup({ mutation: { isPending: true } });

		render(<MovementEntryStockForm companyId="c1" />);

		expect(
			screen
				.getByRole("button", { name: /Registrando/ })
				.hasAttribute("disabled"),
		).toBe(true);
		expect(screen.getByLabelText("Cantidad").hasAttribute("disabled")).toBe(
			true,
		);
	});
});
