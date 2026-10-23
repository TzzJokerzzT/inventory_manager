import { render, screen, within } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Product } from "@/lib/api/schemas";
import { useProducts } from "@/src/features/product/api/use-products";
import { StockStatusChart } from "../components/stock-status-chart";

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

function chartData(testId: string): unknown[] {
	return JSON.parse(
		screen.getByTestId(testId).getAttribute("data-chart-data") ?? "[]",
	);
}

describe("StockStatusChart", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("draws the donut with the real products split by stock status", () => {
		mockProducts([
			product({ id: "p1", stockQuantity: 8 }),
			product({ id: "p2", stockQuantity: 1 }),
			product({ id: "p3", stockQuantity: 0 }),
		]);

		render(<StockStatusChart companyId="c1" />);

		expect(chartData("chart-pie")).toEqual([
			{ name: "Con stock", value: 2 },
			{ name: "Agotados", value: 1 },
		]);
		expect(
			screen.getByLabelText("Distribución del stock: 2 con stock y 1 agotado"),
		).toBeTruthy();
	});

	it("repeats the numbers as text so the information is not chart-only", () => {
		mockProducts([
			product({ id: "p1", stockQuantity: 8 }),
			product({ id: "p2", stockQuantity: 0 }),
		]);

		render(<StockStatusChart companyId="c1" />);

		const table = screen.getByRole("table");
		const rows = within(table).getAllByRole("row");

		expect(within(rows[0]).getByText("Estado")).toBeTruthy();
		expect(within(rows[1]).getByText("Con stock")).toBeTruthy();
		expect(within(rows[1]).getByText("1")).toBeTruthy();
		expect(within(rows[2]).getByText("Agotados")).toBeTruthy();
		expect(within(rows[2]).getByText("1")).toBeTruthy();
	});

	it("says the numbers are the real data of the active company", () => {
		mockProducts([product()]);

		render(<StockStatusChart companyId="c1" />);

		expect(screen.getByText(/datos reales de la empresa activa/i)).toBeTruthy();
	});

	it("reads the products of the company it was given", () => {
		mockProducts([product()]);

		render(<StockStatusChart companyId="c2" />);

		expect(useProductsMock).toHaveBeenCalledWith("c2");
	});

	it("asks for a company before drawing anything", () => {
		mockProducts(undefined);

		render(<StockStatusChart companyId={undefined} />);

		expect(
			screen.getByText("Seleccioná una empresa para ver sus productos."),
		).toBeTruthy();
		expect(screen.queryByTestId("chart-pie")).toBeNull();
	});

	it("shows a spinner while the products load", () => {
		mockProducts(undefined, { isPending: true });

		render(<StockStatusChart companyId="c1" />);

		expect(screen.getByLabelText("Cargando")).toBeTruthy();
	});

	it("shows the API error when the products cannot be read", () => {
		mockProducts(undefined, {
			isError: true,
			error: new ApiError("No pudimos leer el catálogo."),
		});

		render(<StockStatusChart companyId="c1" />);

		expect(
			screen.getByText("No pudimos cargar la distribución del stock"),
		).toBeTruthy();
		expect(screen.getByText("No pudimos leer el catálogo.")).toBeTruthy();
	});

	it("shows an empty state when the company has no products", () => {
		mockProducts([]);

		render(<StockStatusChart companyId="c1" />);

		expect(screen.getByText(/Todavía no cargaste productos/i)).toBeTruthy();
		expect(screen.queryByTestId("chart-pie")).toBeNull();
	});
});
