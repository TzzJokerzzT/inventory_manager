import { KpiCard } from "@/components/design-system";
import type { DashboardMetrics } from "../lib/dashboard-metrics";
import { formatCents } from "../lib/inventory-value";

/** What a card shows while its query has not answered yet. */
const PLACEHOLDER = "—";

/**
 * The four KPIs of the dashboard (S2), all from the active company.
 *
 * `metrics` is `undefined` while the reads are pending or failed, and then every
 * card shows a placeholder instead of a zero: a zero is a real answer ("this
 * company has no products") and the dashboard must not state it before it knows.
 * The units card is labelled **UTC** because the report aggregates per UTC day,
 * so the number is not "today" in the user's local calendar.
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

	return (
		<section
			aria-label="Indicadores"
			aria-busy={placeholder}
			className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
		>
			<KpiCard
				label="Total de productos"
				value={value((data) => data.totalProducts)}
			/>
			<KpiCard
				label="Valor del inventario"
				value={value((data) => formatCents(data.inventoryValueCents))}
			/>
			<KpiCard
				label="Productos con stock crítico"
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
