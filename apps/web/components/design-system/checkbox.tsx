import { cn } from "cn";
import { Check } from "lucide-react";
import { type ComponentProps, useId } from "react";

type CheckboxProps = Omit<ComponentProps<"input">, "type"> & { label: string };

export function Checkbox({
	label,
	id,
	name,
	className,
	...props
}: CheckboxProps) {
	const autoId = useId();
	const controlId = id ?? name ?? autoId;

	return (
		<label
			htmlFor={controlId}
			data-slot="checkbox"
			className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary"
		>
			<span className="relative inline-flex size-5 shrink-0">
				<input
					type="checkbox"
					id={controlId}
					name={name}
					className={cn(
						"peer size-5 appearance-none rounded-sm border border-border bg-surface transition-colors checked:border-primary checked:bg-primary focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none",
						className,
					)}
					{...props}
				/>
				<Check
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 m-auto size-4 text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100"
				/>
			</span>
			<span>{label}</span>
		</label>
	);
}
