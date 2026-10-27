import { KpiCard } from "@/components/design-system";
import type { DashboardMetrics } from "../lib/dashboard-metrics";
import { formatCents } from "../lib/inventory-value";

/** What a card shows while its query has not answered yet. */
const PLACEHOLDER = "—";

/**
 * How many products with stock have no known cost (L27), or `undefined` when
 * there is nothing to report.
 *
 * Those products are left out of both money figures, so silence would read as
 * "everything is valued". The note says how many they are, and nothing at all
 * when the count is zero: a "0 productos sin costo conocido" line would be noise
 * and would push the eye towards a problem that is not there.
 */
function productsWithoutCostNote(count: number): string | undefined {
	if (count <= 0) {
		return undefined;
	}

	return count === 1
		? "1 producto sin costo conocido"
		: `${count} productos sin costo conocido`;
}

/**
 * The five KPIs of the dashboard (S2 + L27), all from the active company.
 *
 * `metrics` is `undefined` while the reads are pending or failed, and then every
 * card shows a placeholder instead of a zero: a zero is a real answer ("this
 * company has no products") and the dashboard must not state it before it knows.
 * The units card is labelled **UTC** because the report aggregates per UTC day,
 * so the number is not "today" in the user's local calendar.
 *
 * The inventory value is **at cost** since L27, and the label says so: the same
 * number read as a sale price would overstate what the company owns. The margin
 * card is its sibling — same subset of products, signed — so the two are read
 * together, and the note under the value accounts for what neither includes.
 */
export function KPIs({
	metrics,
	isLoading = false,
}: {
	metrics?: DashboardMetrics;
	isLoading?: boolean;
}) {
	const placeholder = isLoading || metrics === undefined;
	const value = (render: (data: DashboardMetrics) => string | number) =>
		metrics === undefined ? PLACEHOLDER : render(metrics);
	const withoutCost = metrics
		? productsWithoutCostNote(metrics.productsWithoutCost)
		: undefined;

	return (
		<section
			aria-label="Indicadores"
			aria-busy={placeholder}
			className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
		>
			<KpiCard
				label="Total de productos"
				value={value((data) => data.totalProducts)}
			/>
			<KpiCard
				label="Valor del inventario (a costo)"
				value={value((data) => formatCents(data.inventoryValueCents))}
				note={withoutCost}
			/>
			<KpiCard
				label="Margen potencial"
				value={value((data) => formatCents(data.marginPotentialCents))}
			/>
			<KpiCard
				label="Productos con stock mínimo"
				value={value((data) => data.criticalCount)}
				tone={(metrics?.criticalCount ?? 0) > 0 ? "alert" : "default"}
			/>
			<KpiCard
				label="Unidades movidas hoy (UTC)"
				value={value((data) => data.unitsToday)}
			/>
		</section>
	);
}
