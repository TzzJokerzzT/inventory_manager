"use client";

import { Info } from "lucide-react";
import {
	Alert,
	type Column,
	DataTable,
	KpiCard,
	StockBadge,
} from "@/components/design-system";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import {
	dashboardKpis,
	type StockRow,
	stockAlerts,
	stockTableRows,
} from "../mock";

const stockColumns: Column<StockRow>[] = [
	{ key: "name", header: "Producto" },
	{ key: "sku", header: "SKU" },
	{ key: "category", header: "Categoría" },
	{ key: "price", header: "Precio", align: "right" },
	{ key: "units", header: "Unidades", align: "right" },
	{
		key: "status",
		header: "Estado",
		render: (row) => <StockBadge status={row.status} />,
	},
];

/**
 * MI-20 U2 dashboard content: KPIs, stock alerts and the critical-stock table.
 *
 * The data is mixed and the mock is declared (decision 3): the active company
 * name is real (derived from `GET /companies` through `useActiveCompany`), while
 * the KPIs, alerts and table rows are sample data from `../mock`. The view keeps
 * the columns and the layout; replacing `../mock` with real data (MI-6/MI-9)
 * must not require touching this component.
 */
export function Dashboard() {
	const company = useActiveCompany();

	return (
		<LazyMotionTag
			tag="div"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="flex flex-col gap-6"
		>
			<header>
				<h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
				<p className="mt-1 text-sm text-text-secondary">
					Empresa activa:{" "}
					<span className="font-medium text-text-primary">
						{company?.name ?? "Sin empresa"}
					</span>
				</p>
			</header>

			<div
				role="status"
				className="flex items-start gap-3 rounded-md border border-info bg-info-soft p-4 text-sm text-info-text"
			>
				<Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
				<div className="min-w-0">
					<p className="font-semibold">Datos de muestra</p>
					<p className="mt-1">
						Los indicadores, alertas y la tabla muestran números de ejemplo, no
						los datos reales de tu empresa.
					</p>
				</div>
			</div>

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

			<section aria-label="Alertas de stock" className="flex flex-col gap-3">
				<h2 className="text-lg font-bold text-text-primary">
					Alertas de stock
				</h2>
				<div className="flex flex-col gap-3">
					{stockAlerts.map((alert) => (
						<Alert key={alert.id} variant={alert.variant} title={alert.title}>
							{alert.description}
						</Alert>
					))}
				</div>
			</section>

			<section aria-label="Stock crítico" className="flex flex-col gap-3">
				<h2 className="text-lg font-bold text-text-primary">Stock crítico</h2>
				<DataTable
					columns={stockColumns}
					rows={stockTableRows}
					getRowKey={(row) => row.sku}
				/>
			</section>
		</LazyMotionTag>
	);
}
