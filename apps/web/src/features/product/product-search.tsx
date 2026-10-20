"use client";

import { TextField } from "@/components/design-system";

/**
 * Catalogue search box.
 *
 * Controlled on purpose: the list owns the value and the debounce, so the input
 * never fires a request per keystroke and the term is testable from outside.
 * `type="search"` keeps the browser's own clear affordance.
 */
export function ProductSearch({
	value,
	onChange,
	disabled,
}: {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	return (
		<section aria-label="Búsqueda de productos" className="w-full">
			<TextField
				type="search"
				label="Buscar productos"
				name="productSearch"
				placeholder="Buscar por nombre o SKU"
				autoComplete="off"
				className="w-full sm:max-w-md"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				disabled={disabled}
			/>
		</section>
	);
}
