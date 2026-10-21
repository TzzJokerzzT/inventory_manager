"use client";

import { Alert, DataTable } from "@/components/design-system";
import { ApiError } from "@/lib/api/client";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useProducts } from "@/src/features/product/api/use-products";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import {
	MOVEMENT_TREND_DEFAULT_DAYS,
	useMovementTrend,
} from "../api/use-movement-trend";
import { dashboardMetrics } from "../lib/dashboard-metrics";
import { stockColumns } from "../utils/stockColumns";
import { InventoryValueChart } from "./inventory-value-chart";
import { KPIs } from "./KPIs";
import { MovementTrendChart } from "./movement-trend-chart";
import { StockAlerts } from "./StockAlert";
import { StockStatusChart } from "./stock-status-chart";

const LOAD_ERROR_FALLBACK = "Probá de nuevo en unos segundos.";

/**
 * Dashboard content of the active company: four KPIs, the stock alerts, the
 * critical stock table and — since MI-14 — the three charts.
 *
 * Every number is real and comes from the two reads the dashboard owns: the
 * catalogue (`GET /products`) and the 30-day movement trend report, both scoped
 * to the active company, which is the only guard this view needs. From those two
 * answers `dashboardMetrics` derives the KPIs, the alerts and the table rows
 * once, so the three blocks can never disagree with each other.
 *
 * The KPIs, the alerts and the table handle the reads here — once, at dashboard
 * level, with a loading placeholder and a single error alert — while each chart
 * keeps its own states because it also covers a different failure (one chart's
 * empty window is not the other's).
 */
export function Dashboard() {
	const company = useActiveCompany();
	const companyId = company?.id;
	const products = useProducts(companyId);
	const trend = useMovementTrend(companyId, MOVEMENT_TREND_DEFAULT_DAYS);

	// A metric is only stated when both reads answered: the critical counts come
	// from the catalogue and the units of the day from the report, so showing one
	// without the other would mix a real number with a zero nobody computed.
	const metrics =
		products.data !== undefined && trend.data !== undefined
			? dashboardMetrics(products.data, trend.data.series)
			: undefined;

	const isLoading = products.isPending || trend.isPending;
	const readError = products.isError
		? products.error
		: trend.isError
			? trend.error
			: undefined;
	const hasReadError = products.isError || trend.isError;

	const emptyMessage = hasReadError
		? "No pudimos cargar los productos de la empresa activa."
		: metrics
			? "No hay productos con stock crítico."
			: "Cargando los datos de la empresa activa…";

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

			{hasReadError ? (
				<Alert
					variant="danger"
					title="No pudimos cargar las métricas del dashboard"
				>
					{readError instanceof ApiError
						? readError.message
						: LOAD_ERROR_FALLBACK}
				</Alert>
			) : null}

			<KPIs metrics={metrics} isLoading={isLoading} />

			<StockAlerts metrics={metrics} />

			<SectionTitle ariaLabel="Stock crítico" title="Stock">
				<DataTable
					columns={stockColumns}
					rows={metrics?.criticalProducts ?? []}
					getRowKey={(row) => row.id}
					emptyMessage={emptyMessage}
				/>
			</SectionTitle>

			<SectionTitle ariaLabel="Gráficos" title="Gráficos">
				<p className="text-sm text-text-secondary">
					Estos gráficos son datos reales de la empresa activa.
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
