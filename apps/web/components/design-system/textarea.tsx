"use client";

import { cn } from "cn";
import { type ComponentProps, useId } from "react";
import { Field, FieldLabel } from "../ui/field";

const controlClassName =
	"resize-none scrollbar-none flex field-sizing-content min-h-16 w-full rounded-md border border-border bg-surface px-4 py-2 text-base text-text-primary transition-colors outline-none placeholder:text-text-muted focus-visible:ring-1 focus-visible:border-primary focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/20";

type TextareaFieldProps = ComponentProps<"textarea"> & {
	label: string;
	hint?: string;
	error?: string;
	size?: string;
};

function TextareaField({
	label,
	hint,
	error,
	id,
	name,
	className,
	size = "h-44",
	...props
}: TextareaFieldProps) {
	const autoId = useId();
	const controlId = id ?? name ?? autoId;
	const hintId = hint ? `${controlId}-hint` : undefined;
	const errorId = error ? `${controlId}-error` : undefined;
	const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

	return (
		<Field className={cn("min-w-0", className)}>
			<FieldLabel htmlFor={controlId} className="text-sm text-text-secondary">
				{label}
			</FieldLabel>
			<textarea
				id={controlId}
				name={name}
				data-slot="textarea"
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				className={cn(
					controlClassName,
					size,
					error &&
						"border-danger focus-visible:border-danger focus-visible:ring-danger",
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
		</Field>
	);
}

export { TextareaField };
