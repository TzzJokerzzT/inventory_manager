import { fireEvent, render, screen } from "@testing-library/react";
import type { Product as ProductModel } from "@/lib/api/schemas";
import { useProducts } from "@/src/features/product/api/use-products";
import { useRegisterMovement } from "../api/use-register-movement";
import { MovementOutStockForm } from "../movement-stock-out-form";

jest.mock("@/src/features/product/api/use-products", () => ({
	useProducts: jest.fn(),
}));

jest.mock("../api/use-register-movement", () => ({
	useRegisterMovement: jest.fn(),
}));

const useProductsMock = useProducts as jest.MockedFunction<typeof useProducts>;
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

describe("MovementOutStockForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setup();
	});

	it("registers an OUT movement for the chosen product", () => {
		render(<MovementOutStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		fireEvent.change(screen.getByLabelText("Cantidad"), {
			target: { value: "2" },
		});
		fireEvent.change(screen.getByLabelText("Motivo"), {
			target: { value: "Venta" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Registrar salida" }));

		expect(mutate).toHaveBeenCalledWith(
			{ productId: "p1", type: "OUT", quantity: 2, reason: "Venta" },
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
});
