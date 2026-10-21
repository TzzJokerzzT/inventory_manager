"use client";

import type { ReactNode } from "react";
import {
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import { designTokens } from "@/components/design-system";
import { useProducts } from "@/src/features/product/api/use-products";
import { stockStatusCounts } from "../lib/stock-status";
import {
	ChartEmpty,
	ChartError,
	ChartLoading,
	ChartShell,
} from "./chart-shell";

const COLORS = [designTokens.success, designTokens.destructive];

/**
 * Distribution of the catalogue by **stock status** (S2).
 *
 * The ticket asks for a distribution by category, but the category feature does
 * not exist yet — every product has a null `categoryId` — so a per-category chart
 * would be a single "Sin categoría" slice. The cut is agotados against con stock
 * from the real catalogue of the active company; when categories arrive they
 * replace this split, not add a fourth chart.
 *
 * The numbers are repeated as a table under the donut so the information never
 * depends on reading a coloured shape.
 */
export function StockStatusChart({
	companyId,
}: {
	companyId: string | undefined;
}) {
	const products = useProducts(companyId);
	const rows = products.data ?? [];
	const { outOfStock, inStock } = stockStatusCounts(rows);
	const slices = [
		{ name: "Con stock", value: inStock },
		{ name: "Agotados", value: outOfStock },
	];

	let content: ReactNode;

	if (companyId === undefined) {
		content = (
			<ChartEmpty>Seleccioná una empresa para ver sus productos.</ChartEmpty>
		);
	} else if (products.isPending) {
		content = <ChartLoading />;
	} else if (products.isError) {
		content = (
			<ChartError
				title="No pudimos cargar la distribución del stock"
				error={products.error}
			/>
		);
	} else if (rows.length === 0) {
		content = (
			<ChartEmpty>
				Todavía no cargaste productos: cuando lo hagas, acá vas a ver cómo se
				reparte el stock.
			</ChartEmpty>
		);
	} else {
		content = (
			<figure
				aria-label={`Distribución del stock: ${inStock} con stock y ${outOfStock} ${
					outOfStock === 1 ? "agotado" : "agotados"
				}`}
				className="flex min-w-0 flex-col gap-4"
			>
				<div className="h-64 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={slices}
								dataKey="value"
								nameKey="name"
								innerRadius="55%"
								outerRadius="80%"
								paddingAngle={2}
							>
								{slices.map((slice, index) => (
									<Cell key={slice.name} fill={COLORS[index]} />
								))}
							</Pie>
							<Tooltip />
							<Legend />
						</PieChart>
					</ResponsiveContainer>
				</div>

				<table className="w-full text-sm">
					<caption className="sr-only">
						Productos de la empresa activa por estado del stock
					</caption>
					<thead>
						<tr className="border-b border-border text-left text-text-secondary">
							<th scope="col" className="py-1 font-semibold">
								Estado
							</th>
							<th scope="col" className="py-1 text-right font-semibold">
								Productos
							</th>
						</tr>
					</thead>
					<tbody>
						{slices.map((slice) => (
							<tr key={slice.name}>
								<th scope="row" className="py-1 text-left font-normal">
									{slice.name}
								</th>
								<td className="py-1 text-right">{slice.value}</td>
							</tr>
						))}
					</tbody>
				</table>
			</figure>
		);
	}

	return (
		<ChartShell
			ariaLabel="Distribución del stock"
			title="Distribución del stock"
			caption="Datos reales de la empresa activa: productos agotados y con stock."
		>
			{content}
		</ChartShell>
	);
}
