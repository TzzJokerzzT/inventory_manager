import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import { type ComponentProps, useId } from "react";

const controlClassName =
	"h-12 rounded-md border border-border bg-surface px-4 text-base text-text-primary focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none";

type TextFieldProps = ComponentProps<"input"> & {
	label: string;
	hint?: string;
	error?: string;
};

export function TextField({
	label,
	hint,
	error,
	id,
	name,
	className,
	...props
}: TextFieldProps) {
	const autoId = useId();
	const controlId = id ?? name ?? autoId;
	const hintId = hint ? `${controlId}-hint` : undefined;
	const errorId = error ? `${controlId}-error` : undefined;
	const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

	return (
		<div data-slot="text-field" className="flex flex-col gap-2">
			<label htmlFor={controlId} className="text-sm text-text-secondary">
				{label}
			</label>
			<input
				id={controlId}
				name={name}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				className={cn(
					controlClassName,
					error &&
						"border-danger focus-visible:border-danger focus-visible:ring-danger",
					className,
				)}
				{...props}
			/>
			{hint ? (
				<p id={hintId} className="text-xs text-text-muted">
					{hint}
				</p>
			) : null}
			{error ? (
				<p id={errorId} className="text-xs text-danger-text">
					{error}
				</p>
			) : null}
		</div>
	);
}

type SelectFieldProps = ComponentProps<"select"> & {
	label: string;
	options: { value: string; label: string }[];
	placeholder?: string;
};

export function SelectField({
	label,
	options,
	placeholder,
	id,
	name,
	className,
	...props
}: SelectFieldProps) {
	const autoId = useId();
	const controlId = id ?? name ?? autoId;

	return (
		<div data-slot="select-field" className="flex flex-col gap-2">
			<label htmlFor={controlId} className="text-sm text-text-secondary">
				{label}
			</label>
			<div className="relative">
				<select
					id={controlId}
					name={name}
					className={cn(
						controlClassName,
						"w-full appearance-none pr-10",
						className,
					)}
					{...props}
				>
					{placeholder ? <option value="">{placeholder}</option> : null}
					{options.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
				<ChevronDown
					aria-hidden="true"
					className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-text-muted"
				/>
			</div>
		</div>
	);
}
