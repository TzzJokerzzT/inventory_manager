import { render, screen, within } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Product } from "@/lib/api/schemas";
import { useProducts } from "@/src/features/product/api/use-products";
import { InventoryValueChart } from "../components/inventory-value-chart";

jest.mock("recharts", () => jest.requireActual("../testing/recharts-mock"));
jest.mock("@/src/features/product/api/use-products", () => ({
	useProducts: jest.fn(),
}));

const useProductsMock = useProducts as jest.MockedFunction<typeof useProducts>;

function product(overrides: Partial<Product> = {}): Product {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		photoUrl: null,
		stockQuantity: 1,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

function mockProducts(
	products: Product[] | undefined,
	state: Record<string, unknown> = {},
) {
	useProductsMock.mockReturnValue({
		data: products,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useProducts>);
}

function chartData(): unknown[] {
	return JSON.parse(
		screen.getByTestId("chart-root").getAttribute("data-chart-data") ?? "[]",
	);
}

describe("InventoryValueChart", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("shows the total value of the catalogue in integer cents", () => {
		mockProducts([
			product({ id: "p1", price: "1500.00", stockQuantity: 2 }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				price: "100.00",
				stockQuantity: 1,
			}),
		]);

		render(<InventoryValueChart companyId="c1" />);

		expect(screen.getByText("$ 3.100,00")).toBeTruthy();
	});

	it("draws a bar per product ordered by value", () => {
		mockProducts([
			product({ id: "p1", price: "1500.00", stockQuantity: 2 }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				price: "100.00",
				stockQuantity: 1,
			}),
			product({
				id: "p3",
				name: "Azúcar 1kg",
				price: "50.00",
				stockQuantity: 0,
			}),
		]);

		render(<InventoryValueChart companyId="c1" />);

		expect(chartData()).toEqual([
			{ name: "Café molido 500g", value: 300000 },
			{ name: "Yerba 1kg", value: 10000 },
		]);
	});

	it("lists the same rows as text so the information is not chart-only", () => {
		mockProducts([
			product({ id: "p1", price: "1500.00", stockQuantity: 2 }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				price: "100.00",
				stockQuantity: 1,
			}),
		]);

		render(<InventoryValueChart companyId="c1" />);

		const table = screen.getByRole("table");
		const rows = within(table).getAllByRole("row");

		expect(within(rows[0]).getByText("Producto")).toBeTruthy();
		expect(within(rows[1]).getByText("Café molido 500g")).toBeTruthy();
		expect(within(rows[1]).getByText("2")).toBeTruthy();
		expect(within(rows[1]).getByText("$ 3.000,00")).toBeTruthy();
		expect(within(rows[2]).getByText("$ 100,00")).toBeTruthy();
	});

	it("keeps only the eight products worth the most", () => {
		mockProducts(
			Array.from({ length: 10 }, (_, index) =>
				product({
					id: `p${index + 1}`,
					name: `Producto ${index + 1}`,
					price: `${(index + 1) * 10}.00`,
					stockQuantity: 1,
				}),
			),
		);

		render(<InventoryValueChart companyId="c1" />);

		const rows = chartData() as { name: string }[];

		expect(rows).toHaveLength(8);
		expect(rows[0]).toEqual({ name: "Producto 10", value: 10000 });
		expect(rows.at(-1)).toEqual({ name: "Producto 3", value: 3000 });
	});

	it("says the numbers are the real data of the active company", () => {
		mockProducts([product()]);

		render(<InventoryValueChart companyId="c1" />);

		expect(screen.getByText(/datos reales de la empresa activa/i)).toBeTruthy();
	});

	it("reads the products of the company it was given", () => {
		mockProducts([product()]);

		render(<InventoryValueChart companyId="c2" />);

		expect(useProductsMock).toHaveBeenCalledWith("c2");
	});

	it("asks for a company before drawing anything", () => {
		mockProducts(undefined);

		render(<InventoryValueChart companyId={undefined} />);

		expect(
			screen.getByText("Seleccioná una empresa para ver sus productos."),
		).toBeTruthy();
		expect(screen.queryByTestId("chart-root")).toBeNull();
	});

	it("shows a spinner while the products load", () => {
		mockProducts(undefined, { isPending: true });

		render(<InventoryValueChart companyId="c1" />);

		expect(screen.getByLabelText("Cargando")).toBeTruthy();
	});

	it("shows the API error when the products cannot be read", () => {
		mockProducts(undefined, {
			isError: true,
			error: new ApiError("No pudimos leer el catálogo."),
		});

		render(<InventoryValueChart companyId="c1" />);

		expect(
			screen.getByText("No pudimos cargar el valor del inventario"),
		).toBeTruthy();
		expect(screen.getByText("No pudimos leer el catálogo.")).toBeTruthy();
	});

	it("shows an empty state when the company has no products", () => {
		mockProducts([]);

		render(<InventoryValueChart companyId="c1" />);

		expect(screen.getByText(/Todavía no cargaste productos/i)).toBeTruthy();
		expect(screen.queryByTestId("chart-root")).toBeNull();
	});

	it("shows an empty state when no product has stock", () => {
		mockProducts([product({ stockQuantity: 0 })]);

		render(<InventoryValueChart companyId="c1" />);

		expect(
			screen.getByText(/Ningún producto tiene stock todavía/i),
		).toBeTruthy();
		expect(screen.queryByTestId("chart-root")).toBeNull();
	});
});
