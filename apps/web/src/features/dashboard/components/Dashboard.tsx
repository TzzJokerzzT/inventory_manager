"use client";

import { Info } from "lucide-react";
import { DataTable } from "@/components/design-system";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { stockTableRows } from "@/src/utils/mockData";
import { stockColumns } from "../utils/stockColumns";
import { InventoryValueChart } from "./inventory-value-chart";
import { KPIs } from "./KPIs";
import { MovementTrendChart } from "./movement-trend-chart";
import { StockAlerts } from "./StockAlert";
import { StockStatusChart } from "./stock-status-chart";

/**
 * MI-20 U2 dashboard content: KPIs, alerts, stock table and — since MI-14 — the
 * three real-data charts.
 *
 * The data is mixed and **each part says which one it is** (MI-14 S5, decision 3):
 * the active company name and the three charts are real reads of the active
 * company (products through `useProducts`, the movement trend through
 * `useMovementTrend`), while the KPIs, alerts and table rows are still sample
 * data from `@/src/utils/mockData` (MI-6/MI-9). The "Datos de muestra" notice is
 * scoped to those three blocks on purpose; the charts carry their own caption
 * saying they are real. Replacing the mock module must not require touching this
 * component.
 */
export function Dashboard() {
	const company = useActiveCompany();
	const companyId = company?.id;

	return (
		<LazyMotionTag
			tag="div"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="flex flex-col gap-6"
		>
			<ViewHeader
				title="Dashboard"
				subTitle={`Empresa activa: ${company?.name ?? "Sin empresa"}`}
			/>

			<div
				role="status"
				className="flex items-start gap-3 rounded-md border border-info bg-info-soft p-4 text-sm text-info-text"
			>
				<Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
				<div className="min-w-0">
					<p className="font-semibold">Datos de muestra</p>
					<p className="mt-1">
						Los indicadores, las alertas y la tabla muestran números de ejemplo,
						no los datos reales de tu empresa.
					</p>
				</div>
			</div>

			<KPIs />

			<StockAlerts />

			<SectionTitle ariaLabel="Stock crítico" title="Stock">
				<DataTable
					columns={stockColumns}
					rows={stockTableRows}
					getRowKey={(row) => row.sku}
				/>
			</SectionTitle>

			<SectionTitle ariaLabel="Gráficos" title="Gráficos">
				<p className="text-sm text-text-secondary">
					Estos gráficos son datos reales de la empresa activa, no números de
					ejemplo.
				</p>
				<div className="grid gap-6 xl:grid-cols-2">
					<StockStatusChart companyId={companyId} />
					<InventoryValueChart companyId={companyId} />
					<div className="min-w-0 xl:col-span-2">
						<MovementTrendChart companyId={companyId} />
					</div>
				</div>
			</SectionTitle>
		</LazyMotionTag>
	);
}
