import { render, screen, within } from "@testing-library/react";
import { DataTable } from "@/components/design-system";
import type { Product } from "@/lib/api/schemas";
import { stockColumns } from "../utils/stockColumns";

function product(overrides: Partial<Product> = {}): Product {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		measureUnit: "KILOGRAM",
		photoUrl: null,
		stockQuantity: 0,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

function renderTable(rows: Product[], emptyMessage?: string) {
	return render(
		<DataTable
			columns={stockColumns}
			rows={rows}
			getRowKey={(row) => row.id}
			emptyMessage={emptyMessage}
		/>,
	);
}

describe("stockColumns", () => {
	it("heads the table with the columns of the critical stock summary", () => {
		// S3: Producto, SKU, Categoría, Precio, Unidades y Estado.
		renderTable([product()]);

		expect(
			screen.getAllByRole("columnheader").map((cell) => cell.textContent),
		).toEqual(["Producto", "SKU", "Categoría", "Precio", "Unidades", "Estado"]);
	});

	it("renders a critical product over the real product fields", () => {
		renderTable([product()]);

		const rows = screen.getAllByRole("row");
		const row = within(rows[1]);

		expect(row.getByText("Café molido 500g")).toBeTruthy();
		expect(row.getByText("CAF-500")).toBeTruthy();
		// La categoría todavía no existe como feature: se muestra una raya.
		expect(row.getByText("—")).toBeTruthy();
		expect(row.getByText("$ 1.500,00")).toBeTruthy();
		expect(row.getByText("0")).toBeTruthy();
		expect(row.getByText("Agotado")).toBeTruthy();
	});

	it("marks a product with units up to its threshold as low stock", () => {
		renderTable([product({ stockQuantity: 2, lowStockThreshold: 3 })]);

		expect(screen.getByText("Stock bajo")).toBeTruthy();
		expect(screen.queryByText("Agotado")).toBeNull();
	});

	it("marks a product above its threshold as in stock", () => {
		renderTable([product({ stockQuantity: 9, lowStockThreshold: 3 })]);

		expect(screen.getByText("En stock")).toBeTruthy();
	});

	it("shows the empty message when there is no critical product", () => {
		renderTable([], "No hay productos con stock crítico.");

		expect(
			screen.getByText("No hay productos con stock crítico."),
		).toBeTruthy();
	});
});
