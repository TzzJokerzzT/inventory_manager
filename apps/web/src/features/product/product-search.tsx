import { TextField } from "@/components/design-system";

export function ProductSearch() {
	return (
		<section aria-label="Búsqueda de productos" className="w-full">
			<TextField
				type="search"
				name="productSearch"
				placeholder="Buscar por nombre o SKU"
				autoComplete="off"
				className="w-full sm:max-w-md"
			/>
		</section>
	);
}
