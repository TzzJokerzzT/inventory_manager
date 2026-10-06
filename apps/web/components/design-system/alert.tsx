import { cn } from "cn";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import type { ComponentProps } from "react";

const alertVariants = {
	warning: {
		className: "border-warning bg-warning-soft text-warning-text",
		accent: "bg-warning",
		Icon: TriangleAlert,
		role: "alert",
	},
	danger: {
		className: "border-danger bg-danger-soft text-danger-text",
		accent: "bg-danger",
		Icon: CircleAlert,
		role: "alert",
	},
	success: {
		className: "border-success bg-success-soft text-success-text",
		accent: "bg-success",
		Icon: CircleCheck,
		role: "status",
	},
} as const;

export type AlertVariant = keyof typeof alertVariants;

type AlertProps = ComponentProps<"div"> & {
	variant?: AlertVariant;
	title: string;
};

export function Alert({
	variant = "warning",
	title,
	children,
	className,
	...props
}: AlertProps) {
	const {
		className: variantClassName,
		accent,
		Icon,
		role,
	} = alertVariants[variant];

	return (
		<div
			data-slot="alert"
			role={role}
			className={cn(
				"relative overflow-hidden rounded-md border p-4 text-sm",
				variantClassName,
				className,
			)}
			{...props}
		>
			<span
				aria-hidden="true"
				className={cn("absolute inset-y-0 left-0 w-[3px]", accent)}
			/>
			<div className="flex items-start gap-3">
				<Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
				<div className="min-w-0">
					<p className="font-semibold">{title}</p>
					{children ? <div className="mt-1">{children}</div> : null}
				</div>
			</div>
		</div>
	);
}
