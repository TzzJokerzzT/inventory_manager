import { cn } from "cn";
import type { ComponentProps } from "react";

export const stockStatus = {
	in_stock: {
		label: "En stock",
		className: "border-success bg-success-soft text-success-text",
	},
	low_stock: {
		label: "Stock bajo",
		className: "border-warning bg-warning-soft text-warning-text",
	},
	out_of_stock: {
		label: "Agotado",
		className: "border-danger bg-danger-soft text-danger-text",
	},
	in_transit: {
		label: "En tránsito",
		className: "border-info bg-info-soft text-info-text",
	},
	discontinued: {
		label: "Descontinuado",
		className: "border-border bg-surface-muted text-text-secondary",
	},
} as const;

export type StockStatus = keyof typeof stockStatus;

type StockBadgeProps = ComponentProps<"span"> & {
	status?: StockStatus | (string & {});
};

export function StockBadge({
	status = "discontinued",
	className,
	...props
}: StockBadgeProps) {
	// Unknown values fall back to the neutral state so the badge still renders
	// a visible label instead of disappearing.
	const state = stockStatus[status as StockStatus] ?? stockStatus.discontinued;

	return (
		<span
			data-slot="stock-badge"
			className={cn(
				"inline-flex h-6 items-center whitespace-nowrap rounded-sm border px-2 text-xs font-semibold",
				state.className,
				className,
			)}
			{...props}
		>
			{state.label}
		</span>
	);
}
