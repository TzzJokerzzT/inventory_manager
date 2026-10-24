import { render, screen, within } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { ProductListItem } from "@/lib/api/schemas";
import { useProducts } from "@/src/features/product/api/use-products";
import { InventoryValueChart } from "../components/inventory-value-chart";

jest.mock("recharts", () => jest.requireActual("../testing/recharts-mock"));
jest.mock("@/src/features/product/api/use-products", () => ({
	useProducts: jest.fn(),
}));

const useProductsMock = useProducts as jest.MockedFunction<typeof useProducts>;

/**
 * One catalogue row with a known cost. `price` is far from `unitCost` on
 * purpose: the chart values the stock at cost, never at the listed price (L27).
 */
function product(overrides: Partial<ProductListItem> = {}): ProductListItem {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "9999.00",
		measureUnit: "KILOGRAM",
		availableUnits: 1,
		availableMeasure: "1.000",
		costPerMeasure: "1000.000",
		unitCost: "1500.00",
		marginPerUnit: "500.00",
		photoUrl: null,
		stockQuantity: 1,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

/** A product with stock and no lots: it has no cost to draw (L11). */
function uncosted(overrides: Partial<ProductListItem> = {}): ProductListItem {
	return product({
		availableUnits: 0,
		availableMeasure: "0.000",
		costPerMeasure: null,
		unitCost: null,
		marginPerUnit: null,
		...overrides,
	});
}

function mockProducts(
	products: ProductListItem[] | undefined,
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

	it("shows the total value of the catalogue at cost, in integer cents", () => {
		mockProducts([
			product({ id: "p1", unitCost: "1500.00", stockQuantity: 2 }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				unitCost: "100.00",
				stockQuantity: 1,
			}),
		]);

		render(<InventoryValueChart companyId="c1" />);

		// 2 × 150000 + 1 × 10000 = 310000; el precio de lista no entra.
		expect(screen.getByText("$ 3.100,00")).toBeTruthy();
	});

	it("draws a bar per product ordered by cost value", () => {
		mockProducts([
			product({ id: "p1", unitCost: "1500.00", stockQuantity: 2 }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				unitCost: "100.00",
				stockQuantity: 1,
			}),
			product({
				id: "p3",
				name: "Azúcar 1kg",
				unitCost: "50.00",
				stockQuantity: 0,
			}),
		]);

		render(<InventoryValueChart companyId="c1" />);

		expect(chartData()).toEqual([
			{ name: "Café molido 500g", value: 300000 },
			{ name: "Yerba 1kg", value: 10000 },
		]);
	});

	it("excludes the products with no known cost and sums the bars to the card", () => {
		// L27: las barras excluyen lo que no tiene costo, así que suman la tarjeta.
		mockProducts([
			product({ id: "p1", unitCost: "1500.00", stockQuantity: 2 }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				unitCost: "100.00",
				stockQuantity: 3,
			}),
			uncosted({ id: "p3", name: "Azúcar 1kg", stockQuantity: 5 }),
		]);

		render(<InventoryValueChart companyId="c1" />);

		const rows = chartData() as { name: string; value: number }[];
		const bars = rows.reduce((total, row) => total + row.value, 0);

		expect(rows.map((row) => row.name)).toEqual([
			"Café molido 500g",
			"Yerba 1kg",
		]);
		// 2 × 150000 + 3 × 10000 = 330000, la misma cifra que muestra la tarjeta.
		expect(bars).toBe(330000);
		expect(screen.getByText("$ 3.300,00")).toBeTruthy();
	});

	it("does not fall back to the listed price when the cost is unknown", () => {
		// L27: sin costo no se asume el precio de lista como costo.
		mockProducts([
			uncosted({ id: "p1", price: "9999.00", stockQuantity: 4 }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				unitCost: "100.00",
				stockQuantity: 1,
			}),
		]);

		render(<InventoryValueChart companyId="c1" />);

		const table = screen.getByRole("table");

		expect(chartData()).toEqual([{ name: "Yerba 1kg", value: 10000 }]);
		// 9999,00 × 4 sería el valor si el costo faltante se leyera como el precio.
		expect(screen.queryByText("$ 39.996,00")).toBeNull();
		expect(within(table).getByText("$ 100,00")).toBeTruthy();
	});

	it("lists the same rows as text so the information is not chart-only", () => {
		mockProducts([
			product({ id: "p1", unitCost: "1500.00", stockQuantity: 2 }),
			product({
				id: "p2",
				name: "Yerba 1kg",
				unitCost: "100.00",
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
					unitCost: `${(index + 1) * 10}.00`,
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

	it("shows an empty state that names the missing cost instead of inventing a value", () => {
		// L11: con stock pero sin costo no hay barras ni total real que dibujar.
		mockProducts([
			uncosted({ id: "p1", stockQuantity: 2 }),
			uncosted({ id: "p2", name: "Yerba 1kg", stockQuantity: 3 }),
		]);

		render(<InventoryValueChart companyId="c1" />);

		expect(
			screen.getByText(/Ningún producto tiene costo conocido todavía/i),
		).toBeTruthy();
		expect(screen.queryByTestId("chart-root")).toBeNull();
	});
});
