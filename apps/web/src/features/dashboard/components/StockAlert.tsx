import { Alert } from "@/components/design-system";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import { stockAlerts } from "@/src/utils/mockData";

export function StockAlerts() {
	return (
		<SectionTitle ariaLabel="Alertas de stock" title="Alertas de Stock">
			<div className="flex flex-col gap-3">
				{stockAlerts.map((alert) => (
					<Alert key={alert.id} variant={alert.variant} title={alert.title}>
						{alert.description}
					</Alert>
				))}
			</div>
		</SectionTitle>
	);
}
