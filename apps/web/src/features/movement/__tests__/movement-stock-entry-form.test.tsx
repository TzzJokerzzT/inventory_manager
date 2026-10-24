import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Product as ProductModel } from "@/lib/api/schemas";
import { useCustomers } from "@/src/features/client/api/use-customers";
import { useRegisterLot } from "@/src/features/lot/api/use-register-lot";
import { useProducts } from "@/src/features/product/api/use-products";
import { useProviders } from "@/src/features/provider/api/use-providers";
import { AlertToast } from "@/src/shared/components/AlertToast";
import { useRegisterMovement } from "../api/use-register-movement";
import { MovementEntryStockForm } from "../movement-stock-entry-form";

jest.mock("@/src/features/product/api/use-products", () => ({
	useProducts: jest.fn(),
}));

jest.mock("@/src/features/client/api/use-customers", () => ({
	useCustomers: jest.fn(),
}));

jest.mock("@/src/features/provider/api/use-providers", () => ({
	useProviders: jest.fn(),
}));

jest.mock("@/src/features/lot/api/use-register-lot", () => ({
	useRegisterLot: jest.fn(),
}));

// La salida lee las unidades del producto elegido. Una entrada nunca las pide,
// pero el hook se llama igual desde el formulario compartido: se mockea para no
// necesitar un QueryClient en esta suite.
jest.mock("@/src/features/lot/api/use-product-units", () => ({
	useProductUnits: jest.fn(() => ({
		data: [],
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
	})),
}));

jest.mock("../api/use-register-movement", () => ({
	useRegisterMovement: jest.fn(),
}));

jest.mock("@/src/shared/components/AlertToast", () => ({
	AlertToast: jest.fn(),
}));

const useProductsMock = useProducts as jest.MockedFunction<typeof useProducts>;
const useCustomersMock = useCustomers as jest.MockedFunction<
	typeof useCustomers
>;
const useProvidersMock = useProviders as jest.MockedFunction<
	typeof useProviders
>;
const useRegisterLotMock = useRegisterLot as jest.MockedFunction<
	typeof useRegisterLot
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
		measureUnit: "KILOGRAM",
		photoUrl: null,
		stockQuantity: 8,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

const alertToastMock = AlertToast as jest.MockedFunction<typeof AlertToast>;
const mutate = jest.fn();
const registerLot = jest.fn();

function provider(id: string, name: string) {
	return {
		id,
		companyId: "c1",
		name,
		contact: null,
		createdAt: "2026-10-22T12:00:00.000Z",
		updatedAt: "2026-10-22T12:00:00.000Z",
		lastLot: null,
	};
}

function setup({
	catalogue = [product()],
	mutation = {},
	lotMutation = {},
	providers = [provider("su1", "Plásticos del Sur")],
}: {
	catalogue?: ProductModel[];
	mutation?: Record<string, unknown>;
	lotMutation?: Record<string, unknown>;
	providers?: ReturnType<typeof provider>[];
} = {}) {
	useProductsMock.mockReturnValue({
		data: catalogue,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useProducts>);
	useProvidersMock.mockReturnValue({
		data: providers,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useProviders>);
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
	useRegisterLotMock.mockReturnValue({
		mutate: registerLot,
		mutateAsync: registerLot,
		isPending: false,
		isError: false,
		isSuccess: false,
		error: undefined,
		data: undefined,
		...lotMutation,
	} as unknown as ReturnType<typeof useRegisterLot>);
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

function chooseSupplier(label: string) {
	const input = screen.getByLabelText("Proveedor");
	fireEvent.focus(input);
	fireEvent.keyDown(input, { key: "ArrowDown" });
	const option = screen.getByRole("option", { name: label });
	fireEvent.pointerDown(option);
	fireEvent.pointerUp(option);
	fireEvent.click(option);
}

function openPurchaseBlock() {
	fireEvent.click(
		screen.getByRole("button", { name: "Registrar compra por medida" }),
	);
}

function fillPurchase({
	supplier = "Plásticos del Sur",
	cost = "5900",
	measures = "12.5\n13",
}: {
	supplier?: string;
	cost?: string;
	measures?: string;
} = {}) {
	chooseSupplier(supplier);
	fill("$ por kg", cost);
	fill("Medida de cada unidad", measures);
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

	it("surfaces the API message of insufficient_stock in the error toast", () => {
		mutate.mockImplementation((_input, options) =>
			options?.onError?.(
				new ApiError(
					"No hay stock suficiente: disponible 3.",
					409,
					"insufficient_stock",
				),
			),
		);

		render(<MovementEntryStockForm companyId="c1" />);
		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "10");
		submit();

		expect(alertToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "error",
				description: "No hay stock suficiente: disponible 3.",
			}),
		);
		expect(alertToastMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "success" }),
		);
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

	it("keeps calling the movements endpoint while the purchase block is closed", () => {
		render(<MovementEntryStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		fill("Cantidad", "10");
		submit();

		// Regresión: la entrada suelta sigue siendo el mismo POST de siempre y no
		// toca el padrón de proveedores.
		expect(mutate).toHaveBeenCalledWith(
			{ productId: "p1", type: "IN", quantity: 10, reason: null },
			expect.any(Object),
		);
		expect(registerLot).not.toHaveBeenCalled();
		expect(useProvidersMock).not.toHaveBeenCalled();
	});

	it("registers the purchase through the lots endpoint when the block is open", () => {
		render(<MovementEntryStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		openPurchaseBlock();
		fillPurchase({ measures: "12.5\n13 12,75" });
		fill("Motivo", "Compra a proveedor");
		submit("Registrar compra");

		expect(registerLot).toHaveBeenCalledWith(
			{
				productId: "p1",
				supplierId: "su1",
				costPerMeasure: "5900",
				measures: [12.5, 13, 12.75],
				note: "Compra a proveedor",
			},
			expect.any(Object),
		);
		// La compra es UNA operación: el movimiento suelto no se manda.
		expect(mutate).not.toHaveBeenCalled();
	});

	it("disables the quantity while the block is open: the quantity is the measures", () => {
		render(<MovementEntryStockForm companyId="c1" />);

		openPurchaseBlock();

		expect(screen.getByLabelText("Cantidad").hasAttribute("disabled")).toBe(
			true,
		);
	});

	it("does not ask for the quantity when the purchase is active", () => {
		render(<MovementEntryStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		openPurchaseBlock();
		fillPurchase();
		submit("Registrar compra");

		// El campo de cantidad está deshabilitado y vacío: no puede bloquear el
		// submit de una compra que ya trae sus medidas.
		expect(screen.queryByText("Ingresá la cantidad.")).toBeNull();
		expect(registerLot).toHaveBeenCalled();
	});

	it("blocks the purchase when the block is open but incomplete", () => {
		render(<MovementEntryStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		openPurchaseBlock();
		submit("Registrar compra");

		expect(screen.getByText("Seleccioná un proveedor.")).toBeTruthy();
		expect(screen.getByText("Ingresá el $ por medida.")).toBeTruthy();
		expect(screen.getByText("Ingresá la medida de cada unidad.")).toBeTruthy();
		expect(registerLot).not.toHaveBeenCalled();
		expect(mutate).not.toHaveBeenCalled();
	});

	it("shows the server's numbers in the purchase success notice", () => {
		registerLot.mockImplementation((_input, options) =>
			options?.onSuccess?.({
				id: "lo1",
				companyId: "c1",
				productId: "p1",
				supplierId: "su1",
				receivedAt: "2026-10-23T12:00:00.000Z",
				measureTotal: "25.500",
				costPerMeasure: "5900.00",
				unitCount: 2,
				note: null,
				createdAt: "2026-10-23T12:00:00.000Z",
				units: [],
			}),
		);

		render(<MovementEntryStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		openPurchaseBlock();
		fillPurchase();
		submit("Registrar compra");

		expect(alertToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "success",
				description: expect.stringContaining("2 unidades"),
			}),
		);
		expect(alertToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				description: expect.stringContaining("25,500 kg"),
			}),
		);
	});

	it("translates the purchase errors into Spanish", () => {
		registerLot.mockImplementation((_input, options) =>
			options?.onError?.(new ApiError("Forbidden", 403, "insufficient_role")),
		);

		render(<MovementEntryStockForm companyId="c1" />);

		chooseProduct("Café molido 500g · CAF-500");
		openPurchaseBlock();
		fillPurchase();
		submit("Registrar compra");

		expect(alertToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "error",
				description: "Tu rol no permite esta acción.",
			}),
		);

		registerLot.mockImplementation((_input, options) =>
			options?.onError?.(new ApiError("Not found", 404, "supplier_not_found")),
		);
		submit("Registrar compra");

		expect(alertToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				description: "Ese proveedor ya no existe en esta empresa.",
			}),
		);
	});
});
