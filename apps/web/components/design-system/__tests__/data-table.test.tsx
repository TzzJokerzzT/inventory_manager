import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { type Column, DataTable } from "../data-table";
import { StockBadge, type StockStatus } from "../stock-badge";

type Row = {
	name: string;
	units: number;
	status: StockStatus;
};

const columns: Column<Row>[] = [
	{ key: "name", header: "Producto" },
	{ key: "units", header: "Unidades", align: "right" },
	{
		key: "status",
		header: "Estado",
		render: (row) => <StockBadge status={row.status} />,
	},
];

const rows: Row[] = [
	{ name: "Cable HDMI 2.1", units: 4, status: "out_of_stock" },
	{ name: "Teclado mecánico RGB", units: 18, status: "low_stock" },
];

describe("DataTable", () => {
	it("renders headers and cell content", () => {
		render(
			<DataTable columns={columns} rows={rows} getRowKey={(row) => row.name} />,
		);

		expect(screen.getByText("Producto")).toBeTruthy();
		expect(screen.getByText("Unidades")).toBeTruthy();
		expect(screen.getByText("Cable HDMI 2.1")).toBeTruthy();
		expect(screen.getByText("4")).toBeTruthy();
	});

	it("applies the 52px row height class to rows", () => {
		const { container } = render(
			<DataTable columns={columns} rows={rows} getRowKey={(row) => row.name} />,
		);

		const row = container.querySelector("tbody tr");
		expect(row?.className).toContain("h-13");
	});

	it("renders the emptyMessage across a full-width row", () => {
		render(
			<DataTable
				columns={columns}
				rows={[]}
				getRowKey={() => "none"}
				emptyMessage="No hay resultados"
			/>,
		);

		expect(screen.getByText("No hay resultados")).toBeTruthy();
	});

	it("renders a StockBadge through a render cell with its visible label", () => {
		render(
			<DataTable columns={columns} rows={rows} getRowKey={(row) => row.name} />,
		);

		expect(screen.getByText("Agotado")).toBeTruthy();
		expect(screen.getByText("Stock bajo")).toBeTruthy();
	});
});
