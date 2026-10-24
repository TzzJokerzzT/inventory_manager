import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { ProductListItem as ProductModel } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useMe } from "@/src/features/user/api/use-me";
import { useDeleteProduct } from "../api/use-delete-product";
import { useProducts } from "../api/use-products";
import { usePurgeProduct } from "../api/use-purge-product";
import { useRestoreProduct } from "../api/use-restore-product";
import { Product } from "../product";

jest.mock("@/src/features/company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(),
}));

jest.mock("@/src/features/user/api/use-me", () => ({
	useMe: jest.fn(),
}));

jest.mock("../api/use-products", () => ({
	useProducts: jest.fn(),
}));

jest.mock("../api/use-delete-product", () => ({
	useDeleteProduct: jest.fn(),
}));

jest.mock("../api/use-restore-product", () => ({
	useRestoreProduct: jest.fn(),
}));

jest.mock("../api/use-purge-product", () => ({
	usePurgeProduct: jest.fn(),
}));

const useActiveCompanyMock = useActiveCompany as jest.MockedFunction<
	typeof useActiveCompany
>;
const useMeMock = useMe as jest.MockedFunction<typeof useMe>;
const useProductsMock = useProducts as jest.MockedFunction<typeof useProducts>;
const useDeleteProductMock = useDeleteProduct as jest.MockedFunction<
	typeof useDeleteProduct
>;
const useRestoreProductMock = useRestoreProduct as jest.MockedFunction<
	typeof useRestoreProduct
>;
const usePurgeProductMock = usePurgeProduct as jest.MockedFunction<
	typeof usePurgeProduct
>;
const restoreMutate = jest.fn();
const purgeMutate = jest.fn();

function product(overrides: Partial<ProductModel> = {}): ProductModel {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: "Molido medio",
		sku: "CAF-500",
		price: "1500.00",
		photoUrl: null,
		stockQuantity: 4,
		lowStockThreshold: 0,
		measureUnit: "KILOGRAM",
		availableUnits: 0,
		availableMeasure: "0.000",
		costPerMeasure: null,
		unitCost: null,
		marginPerUnit: null,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

function stubMutation() {
	return {
		mutate: jest.fn(),
		isPending: false,
		isError: false,
		error: undefined,
	};
}

function setup({
	role = "OWNER",
	rows = [product()],
	productsState = {},
}: {
	role?: "OWNER" | "ADMIN" | "MEMBER";
	rows?: ProductModel[];
	productsState?: Record<string, unknown>;
} = {}) {
	useActiveCompanyMock.mockReturnValue({
		id: "c1",
		name: "Empresa Uno",
		createdAt: "2026-10-06T00:00:00.000Z",
	});
	useMeMock.mockReturnValue({
		data: {
			id: "user-1",
			email: "ana@empresa.com",
			fullName: "Ana Pérez",
			createdAt: "2026-10-06T00:00:00.000Z",
			memberships: [
				{
					companyId: "c1",
					role,
					company: {
						id: "c1",
						name: "Empresa Uno",
						createdAt: "2026-10-06T00:00:00.000Z",
					},
				},
			],
		},
		isPending: false,
		isError: false,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useMe>);
	useProductsMock.mockReturnValue({
		data: rows,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
		...productsState,
	} as unknown as ReturnType<typeof useProducts>);
	useDeleteProductMock.mockReturnValue(
		stubMutation() as unknown as ReturnType<typeof useDeleteProduct>,
	);
	useRestoreProductMock.mockReturnValue({
		...stubMutation(),
		mutate: restoreMutate,
	} as unknown as ReturnType<typeof useRestoreProduct>);
	usePurgeProductMock.mockReturnValue({
		...stubMutation(),
		mutate: purgeMutate,
	} as unknown as ReturnType<typeof usePurgeProduct>);
}

describe("Product", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("lists the real catalogue of the active company", () => {
		setup();

		render(<Product />);

		expect(useProductsMock).toHaveBeenCalledWith("c1", "", undefined);
		expect(screen.getByRole("heading", { name: "Productos" })).toBeTruthy();
		expect(screen.getByText("Café molido 500g")).toBeTruthy();
		expect(screen.getByText("CAF-500")).toBeTruthy();
		// Deterministic es-AR rendering of the decimal string.
		expect(screen.getByText("$ 1.500,00")).toBeTruthy();
		expect(screen.getByText("4")).toBeTruthy();
	});

	it("does not append the purchase measure to the sale price", () => {
		// `measureUnit` is how the product is BOUGHT (its lots are weighed); the
		// price is what one UNIT sells for. Mixing them would price a unit as a
		// kilogram, so the cell stays plain and the unit lives in the purchase form.
		setup({
			rows: [product({ price: "5900.00", measureUnit: "KILOGRAM" })],
		});

		render(<Product />);

		expect(screen.getByText("$ 5.900,00")).toBeTruthy();
		expect(screen.queryByText("/ kg")).toBeNull();
		expect(screen.queryByText("$ 5.900,00 / kg")).toBeNull();
	});

	it("shows the cost and the margin of one unit next to the sale price", () => {
		// L26: las dos cifras se comparan contra el precio de venta de una
		// unidad, que es justo lo que la tabla ya muestra.
		setup({
			rows: [product({ unitCost: "29500.00", marginPerUnit: "500.00" })],
		});

		render(<Product />);

		expect(
			screen.getByRole("columnheader", { name: "Costo por unidad" }),
		).toBeTruthy();
		expect(
			screen.getByRole("columnheader", { name: "Margen por unidad" }),
		).toBeTruthy();
		expect(screen.getByText("$ 29.500,00")).toBeTruthy();
		expect(screen.getByText("$ 500,00")).toBeTruthy();
	});

	it("shows an em dash, never a zero, for a product without units", () => {
		// Sin unidades disponibles el costo y el margen son desconocidos (L11):
		// un cero inventaría un costo que nadie pagó.
		setup({
			rows: [
				product({ availableUnits: 0, unitCost: null, marginPerUnit: null }),
			],
		});

		render(<Product />);

		// El guión se ve y el lector de pantalla escucha el motivo.
		expect(screen.getAllByText("—")).toHaveLength(2);
		expect(screen.getByText("Sin costo")).toBeTruthy();
		expect(screen.getByText("Sin margen")).toBeTruthy();
		expect(screen.queryByText("$ 0,00")).toBeNull();
		expect(screen.queryByText("0")).toBeNull();
	});

	it("keeps the sign of a negative margin", () => {
		// Vender por debajo del costo es un dato válido y tiene que doler a la
		// vista: se muestra con su signo, no como un valor absoluto.
		setup({
			rows: [product({ unitCost: "29500.00", marginPerUnit: "-20500.00" })],
		});

		render(<Product />);

		expect(screen.getByText("-$ 20.500,00")).toBeTruthy();
	});

	it("does not add the cost per measure to the catalogue", () => {
		// L20/L26: el $/medida se compara contra el de otros proveedores, no
		// contra el precio de una unidad; esa comparación vive en la compra y en
		// el padrón.
		setup({
			rows: [
				product({
					measureUnit: "KILOGRAM",
					availableMeasure: "10.500",
					costPerMeasure: "5900.00",
					unitCost: "29500.00",
					marginPerUnit: "0.00",
				}),
			],
		});

		render(<Product />);

		expect(screen.queryByRole("columnheader", { name: /medida/ })).toBeNull();
		expect(screen.queryByText("$ 5.900,00")).toBeNull();
		expect(screen.queryByText("/ kg")).toBeNull();
	});

	it("shows a thumbnail only when the product has a photo", () => {
		const withPhoto = product({
			photoUrl: "https://res.cloudinary.com/demo/image/upload/cafe.jpg",
		});
		setup({ rows: [withPhoto, product({ id: "p2", sku: "YER-1" })] });

		const { container } = render(<Product />);

		const images = container.querySelectorAll("img");
		expect(images).toHaveLength(1);
		expect(images[0].getAttribute("src")).toBe(
			"https://res.cloudinary.com/demo/image/upload/cafe.jpg",
		);
	});

	it("shows a meaningful empty state", () => {
		setup({ rows: [] });

		render(<Product />);

		expect(screen.getByText(/Todavía no cargaste productos/)).toBeTruthy();
	});

	it("searches by name or SKU and refreshes the query after the debounce", async () => {
		setup({ rows: [] });

		render(<Product />);

		fireEvent.change(screen.getByLabelText("Buscar productos"), {
			target: { value: "café" },
		});

		await waitFor(() => {
			expect(useProductsMock).toHaveBeenLastCalledWith("c1", "café", undefined);
		});
		expect(
			screen.getByText(/No encontramos productos para «café»/),
		).toBeTruthy();
	});

	it("shows the loading state while the catalogue is being read", () => {
		setup({ productsState: { data: undefined, isPending: true } });

		render(<Product />);

		expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
	});

	it("shows an alert with the API message when the catalogue cannot be read", () => {
		const error = new ApiError("No tenés acceso a esta empresa.", 403);
		setup({
			productsState: { data: undefined, isError: true, error },
		});

		render(<Product />);

		expect(screen.getByText("No pudimos cargar los productos")).toBeTruthy();
		expect(screen.getByText("No tenés acceso a esta empresa.")).toBeTruthy();
	});

	it("does not offer any write action to a MEMBER", () => {
		setup({ role: "MEMBER", rows: [product()] });

		render(<Product />);

		expect(screen.queryByRole("link", { name: /Nuevo Producto/ })).toBeNull();
		expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull();
		expect(screen.queryByRole("columnheader", { name: "Acciones" })).toBeNull();
	});

	it("offers the write actions to an ADMIN", () => {
		setup({ role: "ADMIN", rows: [product()] });

		render(<Product />);

		expect(
			screen.getByRole("link", { name: /Nuevo Producto/ }).getAttribute("href"),
		).toBe("/dashboard/products/create");
		expect(screen.getByRole("link", { name: "Editar" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Eliminar" })).toBeTruthy();
	});

	it("switches the list to the trash and back", () => {
		setup();

		render(<Product />);

		expect(useProductsMock).toHaveBeenLastCalledWith("c1", "", undefined);

		fireEvent.click(screen.getByRole("button", { name: "Papelera" }));

		expect(useProductsMock).toHaveBeenLastCalledWith("c1", "", {
			deleted: true,
		});

		fireEvent.click(screen.getByRole("button", { name: "Catálogo" }));

		expect(useProductsMock).toHaveBeenLastCalledWith("c1", "", undefined);
	});

	it("hides create, edit and delete in the trash and offers only Restaurar", () => {
		setup({ role: "ADMIN", rows: [product()] });

		render(<Product />);

		fireEvent.click(screen.getByRole("button", { name: "Papelera" }));

		expect(screen.queryByRole("link", { name: /Nuevo Producto/ })).toBeNull();
		expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull();
		expect(screen.getByRole("button", { name: "Restaurar" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Papelera" })).toBeTruthy();
	});

	it("restores a product from the trash without a confirmation", () => {
		setup({ role: "ADMIN", rows: [product()] });

		render(<Product />);

		fireEvent.click(screen.getByRole("button", { name: "Papelera" }));
		fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));

		expect(useRestoreProductMock).toHaveBeenCalledWith("c1");
		expect(restoreMutate).toHaveBeenCalledTimes(1);
		expect(restoreMutate.mock.calls[0][0]).toEqual({ productId: "p1" });
	});

	it("hides the purge from an ADMIN in the trash", () => {
		setup({ role: "ADMIN", rows: [product()] });

		render(<Product />);

		fireEvent.click(screen.getByRole("button", { name: "Papelera" }));

		expect(screen.getByRole("button", { name: "Restaurar" })).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "Eliminar definitivamente" }),
		).toBeNull();
	});

	it("offers the purge to an OWNER in the trash, and only there", () => {
		setup({ role: "OWNER", rows: [product()] });

		render(<Product />);

		expect(
			screen.queryByRole("button", { name: "Eliminar definitivamente" }),
		).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Papelera" }));

		expect(usePurgeProductMock).toHaveBeenCalledWith("c1");
		expect(
			screen.getByRole("button", { name: "Eliminar definitivamente" }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Restaurar" })).toBeTruthy();
	});

	it("purges a product from the trash through the confirmation dialog", () => {
		setup({ role: "OWNER", rows: [product()] });

		render(<Product />);

		fireEvent.click(screen.getByRole("button", { name: "Papelera" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Eliminar definitivamente" }),
		);

		const dialog = screen.getByRole("dialog", {
			name: "Eliminar definitivamente",
		});
		expect(purgeMutate).not.toHaveBeenCalled();

		fireEvent.click(
			within(dialog).getByRole("button", {
				name: "Eliminar definitivamente",
			}),
		);

		expect(purgeMutate).toHaveBeenCalledTimes(1);
		expect(purgeMutate.mock.calls[0][0]).toEqual({ productId: "p1" });
		expect(restoreMutate).not.toHaveBeenCalled();
	});

	it("shows the trash empty state, distinct from the active one", () => {
		setup({ rows: [] });

		render(<Product />);

		fireEvent.click(screen.getByRole("button", { name: "Papelera" }));

		expect(screen.getByText("No hay productos en la papelera.")).toBeTruthy();
		expect(screen.queryByText(/Todavía no cargaste productos/)).toBeNull();
	});

	it("searches inside the trash", async () => {
		setup({ rows: [] });

		render(<Product />);

		fireEvent.click(screen.getByRole("button", { name: "Papelera" }));
		fireEvent.change(screen.getByLabelText("Buscar productos"), {
			target: { value: "café" },
		});

		await waitFor(() => {
			expect(useProductsMock).toHaveBeenLastCalledWith("c1", "café", {
				deleted: true,
			});
		});
		expect(
			screen.getByText(/No encontramos productos para «café» en la papelera/),
		).toBeTruthy();
	});
});
