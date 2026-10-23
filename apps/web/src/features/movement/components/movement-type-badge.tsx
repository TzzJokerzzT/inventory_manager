import { cn } from "cn";
import type { ComponentProps } from "react";

/**
 * Direction badge of a movement: entry or exit.
 *
 * `StockBadge` cannot be reused here: its labels are the stock *statuses*
 * (`En stock`, `Agotado`…), not the direction of a movement, and the design
 * system is not the place to overload them. The recipe is the same one the badge
 * uses — one colour pair per state — so the table stays visually consistent.
 */
const movementTypeBadge = {
	IN: {
		label: "Entrada",
		className: "border-success bg-success-soft text-success-text",
	},
	OUT: {
		label: "Salida",
		className: "border-info bg-info-soft text-info-text",
	},
} as const;

export type MovementType = keyof typeof movementTypeBadge;

type MovementTypeBadgeProps = ComponentProps<"span"> & {
	type: MovementType;
};

export function MovementTypeBadge({
	type,
	className,
	...props
}: MovementTypeBadgeProps) {
	const state = movementTypeBadge[type];

	return (
		<span
			data-slot="movement-type-badge"
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
