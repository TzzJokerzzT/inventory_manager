"use client";

import { TextField } from "@/components/design-system";

/**
 * Customer search box.
 *
 * Controlled on purpose: the list owns the value and the debounce, so the input
 * never fires a request per keystroke and the term is testable from outside.
 * The placeholder names the three fields the API matches against — name, email
 * and phone — because a person cannot see that in an empty result. `type="search"`
 * keeps the browser's own clear affordance.
 */
export function CustomerSearch({
	value,
	onChange,
	disabled,
}: {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	return (
		<section aria-label="Búsqueda de clientes" className="w-full">
			<TextField
				type="search"
				label="Buscar clientes"
				name="customerSearch"
				placeholder="Buscar por nombre, email o teléfono"
				autoComplete="off"
				className="w-full sm:max-w-md"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				disabled={disabled}
			/>
		</section>
	);
}
