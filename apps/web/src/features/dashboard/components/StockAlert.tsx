import { Alert } from "@/components/design-system";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import type { DashboardMetrics } from "../lib/dashboard-metrics";

function productCount(count: number, singular: string, plural: string) {
	return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * The stock alerts (S4), derived from the same metrics as the KPI and the table.
 *
 * Two independent facts produce two alerts: sold-out products are a danger
 * because they cannot be sold, and products at or below their threshold are a
 * warning because they will run out. When both are zero the section says so
 * instead of staying silent, so an empty dashboard is never ambiguous between
 * "all good" and "not loaded". While the metrics are unavailable the section
 * renders nothing: a placeholder alert would be a number nobody computed.
 */
export function StockAlerts({
	metrics,
}: {
	metrics: DashboardMetrics | undefined;
}) {
	if (!metrics) {
		return null;
	}

	const { outOfStockCount, lowStockOnlyCount } = metrics;

	return (
		<SectionTitle ariaLabel="Alertas de stock" title="Alertas de Stock">
			<div className="flex flex-col gap-3">
				{outOfStockCount > 0 ? (
					<Alert
						variant="danger"
						title={productCount(
							outOfStockCount,
							"producto agotado",
							"productos agotados",
						)}
					>
						Sin unidades disponibles para la venta. Reponé el stock para volver
						a venderlos.
					</Alert>
				) : null}

				{lowStockOnlyCount > 0 ? (
					<Alert
						variant="warning"
						title={productCount(
							lowStockOnlyCount,
							"producto con stock bajo",
							"productos con stock bajo",
						)}
					>
						Están en o por debajo del umbral mínimo. Revisá el stock y generá
						una orden de reposición.
					</Alert>
				) : null}

				{outOfStockCount === 0 && lowStockOnlyCount === 0 ? (
					<Alert variant="success" title="Sin alertas de stock">
						Ningún producto está agotado ni por debajo de su umbral mínimo.
					</Alert>
				) : null}
			</div>
		</SectionTitle>
	);
}
