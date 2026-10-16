import { KpiCard } from "@/components/design-system";
import { dashboardKpis } from "@/src/utils/mockData";

export function KPIs() {
	return (
		<section
			aria-label="Indicadores"
			className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
		>
			{dashboardKpis.map((kpi) => (
				<KpiCard
					key={kpi.id}
					label={kpi.label}
					value={kpi.value}
					delta={kpi.delta}
					note={kpi.note}
					tone={kpi.tone}
				/>
			))}
		</section>
	);
}
