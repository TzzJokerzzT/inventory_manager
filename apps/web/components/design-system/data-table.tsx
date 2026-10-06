import { cn } from "cn";
import type { JSX, ReactNode } from "react";

export type Column<T> = {
	key: string;
	header: string;
	align?: "left" | "right";
	render?: (row: T) => ReactNode;
	className?: string;
};

export type DataTableProps<T> = {
	columns: Column<T>[];
	rows: T[];
	getRowKey: (row: T, index: number) => string;
	emptyMessage?: string;
};

function cellContent<T>(row: T, column: Column<T>): ReactNode {
	if (column.render) {
		return column.render(row);
	}
	return String((row as unknown as Record<string, unknown>)[column.key] ?? "");
}

export function DataTable<T>({
	columns,
	rows,
	getRowKey,
	emptyMessage = "No hay datos",
}: DataTableProps<T>): JSX.Element {
	const cellAlign = (align?: Column<T>["align"]) =>
		align === "right" ? "text-right" : "text-left";

	return (
		<div
			data-slot="data-table"
			className="overflow-hidden rounded-md border border-border bg-surface"
		>
			<table className="w-full border-collapse">
				<thead>
					<tr className="bg-surface-muted">
						{columns.map((column) => (
							<th
								key={column.key}
								scope="col"
								className={cn(
									"h-13 border-b border-border px-4 align-middle text-xs font-medium uppercase text-text-muted",
									cellAlign(column.align),
									column.className,
								)}
							>
								{column.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.length === 0 ? (
						<tr>
							<td
								colSpan={columns.length}
								className="h-13 px-4 text-sm text-text-muted"
							>
								{emptyMessage}
							</td>
						</tr>
					) : (
						rows.map((row, index) => (
							<tr
								key={getRowKey(row, index)}
								className="h-13 border-b border-border last:border-b-0"
							>
								{columns.map((column) => (
									<td
										key={column.key}
										className={cn(
											"h-13 px-4 align-middle text-sm text-text-primary",
											cellAlign(column.align),
											column.className,
										)}
									>
										{cellContent(row, column)}
									</td>
								))}
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}
