import { cn } from "cn";
import { type ComponentProps, useId } from "react";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "../ui/combobox";
import { FieldLabel } from "../ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

const controlClassName =
	"h-12 rounded-md border border-border bg-surface px-4 text-base text-text-primary transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none";

type TextFieldProps = ComponentProps<"input"> & {
	label?: string;
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
		<div
			data-slot="text-field"
			className={cn("flex flex-col gap-2", className)}
		>
			<FieldLabel htmlFor={controlId} className="text-sm text-text-secondary">
				{label}
			</FieldLabel>
			<input
				id={controlId}
				name={name}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				className={cn(
					controlClassName,
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
		</div>
	);
}

// The Base UI primitive is generic over its value; the field binds it to a
// single string and exposes that contract (`null` is the primitive's cleared
// value), so `multiple` is not part of the field's API.
type SelectFieldProps = Omit<
	ComponentProps<typeof Select>,
	"children" | "value" | "defaultValue" | "onValueChange" | "multiple"
> & {
	label: string;
	options: { value: string; label: string }[];
	placeholder?: string;
	id?: string;
	className?: string;
	value?: string | null;
	defaultValue?: string | null;
	onValueChange?: (value: string | null) => void;
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
		<div
			data-slot="select-field"
			className={cn("flex min-w-0 flex-col gap-2", className)}
		>
			<FieldLabel htmlFor={controlId} className="text-sm text-text-secondary">
				{label}
			</FieldLabel>

			<Select<string> name={name} {...props} items={options}>
				<SelectTrigger
					id={controlId}
					className={cn(
						controlClassName,
						"w-full min-w-0 justify-between gap-2",
						// shadcn fija la altura con data-size; sin esto gana h-9 sobre h-12.
						"dark: bg-sruface dark:hover:bg-surface",
						"data-[size=default]:h-12",
						"data-[placeholder]:text-text-muted [&_svg]:text-text-muted",
						// shadcn pinta un fondo propio en dark mode; mantenemos el tuyo.
						"dark:bg-surface dark:hover:bg-surface",
					)}
				>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>

				<SelectContent
					alignItemWithTrigger={false}
					sideOffset={4}
					className={cn(
						"border-border bg-surface text-text-primary",
						// Mismo ancho que el campo, sin pasar nunca del ancho de pantalla.
						"w-(--anchor-width) min-w-(--anchor-width) max-w-[calc(100vw-2rem)]",
						// Animaciones de Base UI: usa data-open / data-closed.
						"data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
						"data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						"data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
						"data-closed:duration-150 data-open:duration-200",
						"scrollbar-none",
					)}
				>
					{placeholder ? (
						<SelectItem
							key={placeholder}
							value={""}
							className="min-h-10 py-2 text-base text-text-primary focus:bg-surface-muted focus:text-text-primary"
						>
							{placeholder}
						</SelectItem>
					) : null}
					{options.map((option) => (
						<SelectItem
							key={option.value}
							value={option.value}
							className="min-h-10 py-2 text-base text-text-primary focus:bg-surface-muted focus:text-text-primary"
						>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
type Option = { value: string; label: string };

type AutoCompleteProps = {
	label: string;
	options: Option[];
	placeholder?: string;
	emptyMessage?: string;
	id?: string;
	name?: string;
	className?: string;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	disabled?: boolean;
	required?: boolean;
};
export function AutoComplete({
	label,
	options,
	placeholder,
	emptyMessage = "Sin resultados.",
	id,
	name,
	className,
	value,
	defaultValue,
	onValueChange,
	disabled,
	required,
}: AutoCompleteProps) {
	const autoId = useId();
	const controlId = id ?? name ?? autoId;

	// El combobox trabaja con el objeto completo; aquí lo traducimos al string.
	// `undefined` lo deja sin controlar; `null` lo controla y lo deja vacío.
	const findOption = (optionValue: string | undefined) =>
		optionValue === undefined
			? undefined
			: (options.find((option) => option.value === optionValue) ?? null);

	return (
		<div
			data-slot="select-field"
			className={cn("flex min-w-0 flex-col gap-2", className)}
		>
			<FieldLabel htmlFor={controlId} className="text-sm text-text-secondary">
				{label}
			</FieldLabel>

			<Combobox
				items={options}
				name={name}
				value={findOption(value)}
				defaultValue={findOption(defaultValue)}
				onValueChange={(option: Option | null) =>
					onValueChange?.(option?.value ?? "")
				}
				itemToStringLabel={(option: Option) => option.label}
				itemToStringValue={(option: Option) => option.value}
				isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
				disabled={disabled}
				required={required}
			>
				<ComboboxInput
					id={controlId}
					placeholder={placeholder}
					showClear
					className={cn(
						controlClassName,
						"w-full min-w-0 gap-2 px-0",
						"dark:bg-surface dark:hover:bg-surface",
						// Misma variante que usa InputGroup, para ganarle a su
						// `ring-3 ring-ring/50` en vez de convivir con él.
						"has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-primary",
						// El padding y el texto los lleva el <input> interno.
						"[&_input]:px-4 [&_input]:text-base [&_input]:text-text-primary [&_input]:placeholder:text-text-muted",
						"[&_svg]:text-text-muted",
					)}
				/>

				<ComboboxContent
					sideOffset={4}
					className={cn(
						// El popup dibuja un ring de 1px, no un border: se colorea con ring-*.
						"bg-surface text-text-primary ring-border",
						// Pisa el min-w base (anchor + 1.75rem) para igualar el ancho del campo.
						"w-(--anchor-width) min-w-(--anchor-width) max-w-[calc(100vw-2rem)]",
						"data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
						"data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						"data-closed:duration-150 data-open:duration-200",
					)}
				>
					<ComboboxEmpty className="py-3 text-sm text-text-muted">
						{emptyMessage}
					</ComboboxEmpty>
					<ComboboxList className="scrollbar-none">
						{(option: Option) => (
							<ComboboxItem
								key={option.value}
								value={option}
								className="min-h-10 py-2 text-base text-text-primary data-highlighted:bg-surface-muted data-highlighted:text-text-primary"
							>
								{option.label}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</div>
	);
}
