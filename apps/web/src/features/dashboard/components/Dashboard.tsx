"use client";

import { Info } from "lucide-react";
import { DataTable } from "@/components/design-system";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { stockTableRows } from "@/src/utils/mockData";
import { stockColumns } from "../utils/stockColumns";
import { KPIs } from "./KPIs";
import { StockAlerts } from "./StockAlert";

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
						Los indicadores, alertas y la tabla muestran números de ejemplo, no
						los datos reales de tu empresa.
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
		</LazyMotionTag>
	);
}
