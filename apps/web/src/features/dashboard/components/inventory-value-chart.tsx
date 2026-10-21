"use client";

import type { ReactNode } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { designTokens, KpiCard } from "@/components/design-system";
import { useProducts } from "@/src/features/product/api/use-products";
import { formatCents, inventoryValue } from "../lib/inventory-value";
import {
	ChartEmpty,
	ChartError,
	ChartLoading,
	ChartShell,
} from "./chart-shell";

/** How many products the bar chart and its table show. */
const TOP_PRODUCTS_LIMIT = 8;

/**
 * Value of the inventory: `price × stock` of the real catalogue of the active
 * company, summed in integer cents (S4).
 *
 * The sum happens in the client because `GET /products` already returns the whole
 * catalogue and the price is a decimal string; adding floats would show a total
 * nobody can reconcile. The card shows the company's total and the bars rank the
 * products worth the most, with the same numbers repeated as text so the
 * information is never only a bar length.
 */
export function InventoryValueChart({
	companyId,
}: {
	companyId: string | undefined;
}) {
	const products = useProducts(companyId);
	const catalogue = products.data ?? [];
	const { totalCents, topProducts } = inventoryValue(catalogue);
	const top = topProducts.slice(0, TOP_PRODUCTS_LIMIT);
	const bars = top.map((row) => ({ name: row.name, value: row.cents }));

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
				title="No pudimos cargar el valor del inventario"
				error={products.error}
			/>
		);
	} else if (catalogue.length === 0) {
		content = (
			<ChartEmpty>
				Todavía no cargaste productos: cuando lo hagas, acá vas a ver cuánto
				vale tu inventario.
			</ChartEmpty>
		);
	} else if (top.length === 0) {
		content = (
			<ChartEmpty>
				Ningún producto tiene stock todavía: el valor del inventario es{" "}
				{formatCents(totalCents)}.
			</ChartEmpty>
		);
	} else {
		content = (
			<figure
				aria-label={[
					`Valor del inventario: ${formatCents(totalCents)}.`,
					`Los ${top.length} productos de mayor valor, de mayor a menor.`,
				].join(" ")}
				className="flex min-w-0 flex-col gap-4"
			>
				<KpiCard
					label="Valor total del inventario"
					value={formatCents(totalCents)}
				/>

				<div className="h-72 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={bars}
							layout="vertical"
							margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
						>
							<CartesianGrid horizontal={false} />
							<XAxis
								type="number"
								tickFormatter={(value: number) => formatCents(Number(value))}
							/>
							<YAxis type="category" dataKey="name" width={150} />
							<Tooltip formatter={(value) => formatCents(Number(value))} />
							<Bar
								dataKey="value"
								name="Valor"
								fill={designTokens["chart-1"]}
							/>
						</BarChart>
					</ResponsiveContainer>
				</div>

				<table className="w-full text-sm">
					<caption className="sr-only">
						Los productos de mayor valor de la empresa activa, con sus unidades
						y su valor
					</caption>
					<thead>
						<tr className="border-b border-border text-left text-text-secondary">
							<th scope="col" className="py-1 font-semibold">
								Producto
							</th>
							<th scope="col" className="py-1 text-right font-semibold">
								Unidades
							</th>
							<th scope="col" className="py-1 text-right font-semibold">
								Valor
							</th>
						</tr>
					</thead>
					<tbody>
						{top.map((row) => (
							<tr key={row.id}>
								<th scope="row" className="py-1 text-left font-normal">
									{row.name}
								</th>
								<td className="py-1 text-right">{row.quantity}</td>
								<td className="py-1 text-right">{formatCents(row.cents)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</figure>
		);
	}

	return (
		<ChartShell
			ariaLabel="Valor del inventario"
			title="Valor del inventario por producto"
			caption="Datos reales de la empresa activa: precio por stock de cada producto, sumado en centavos."
		>
			{content}
		</ChartShell>
	);
}
