import { cn } from "cn";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ComponentProps } from "react";

type KpiCardProps = ComponentProps<"div"> & {
	label: string;
	value: string | number;
	delta?: {
		value: string;
		direction: "up" | "down";
		caption?: string;
	};
	note?: string;
	tone?: "default" | "alert";
};

function signedValue(value: string, direction: "up" | "down"): string {
	const magnitude = value.replace(/^[+\-−]\s*/, "");
	return direction === "up" ? `+${magnitude}` : `−${magnitude}`;
}

export function KpiCard({
	label,
	value,
	delta,
	note,
	tone = "default",
	className,
	...props
}: KpiCardProps) {
	const Icon = delta?.direction === "down" ? TrendingDown : TrendingUp;

	return (
		<div
			data-slot="kpi-card"
			className={cn(
				"rounded-md border p-4",
				tone === "alert"
					? "border-warning bg-warning-soft"
					: "border-border bg-surface",
				className,
			)}
			{...props}
		>
			<p className="text-sm text-text-secondary">{label}</p>
			<p className="mt-1 text-[2rem] font-bold leading-10 text-text-primary">
				{value}
			</p>
			{delta ? (
				<div className="mt-1 flex items-center gap-2">
					<Icon
						aria-hidden="true"
						className={cn(
							"size-4",
							delta.direction === "up"
								? "text-success-text"
								: "text-danger-text",
						)}
					/>
					<span
						className={cn(
							"text-sm font-semibold",
							delta.direction === "up"
								? "text-success-text"
								: "text-danger-text",
						)}
					>
						{signedValue(delta.value, delta.direction)}
					</span>
					<span className="text-sm text-text-muted">
						{delta.caption ?? "vs. mes anterior"}
					</span>
				</div>
			) : null}
			{note ? <p className="mt-1 text-sm text-warning-text">{note}</p> : null}
		</div>
	);
}
