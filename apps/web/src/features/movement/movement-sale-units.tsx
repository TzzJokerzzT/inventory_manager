"use client";

import { Checkbox } from "@/components/design-system";
import type { Product, ProductUnit } from "@/lib/api/schemas";
import { measureUnitLabel } from "@/lib/measure-unit";
import { formatMeasure } from "@/src/features/lot/lib/purchase-summary";
import { formatPrice } from "@/src/features/product/lib/format-price";

/** The section's label, and the name the tests and the copy share. */
export const SALE_UNITS_LABEL = "Unidades a vender";

/** Shown while the read is in flight. */
const LOADING = "Cargando unidades…";

/** Shown when the read failed: the sale cannot offer units it does not know. */
const LOAD_ERROR = "No pudimos cargar las unidades. Probá de nuevo.";

/** Shown when the backend answers that no unit is still available. */
const NO_UNITS = "Este producto no tiene unidades disponibles.";

/**
 * What one checkbox says: the code of the unit, its measure in the unit the
 * product is bought in, and what that unit cost (L25).
 *
 * The measure carries its unit (kg, L, m) because the number alone means
 * nothing; the cost does **not** (L20) — it is money, not a price per measure,
 * and the sale price is written separately and never carries a measure either.
 */
function unitLabel(unit: ProductUnit, product: Product | undefined): string {
	const measure = formatMeasure(unit.measure);
	const suffix = product ? ` ${measureUnitLabel(product.measureUnit)}` : "";

	return `${unit.code} · ${measure}${suffix} · ${formatPrice(unit.cost)}`;
}

/**
 * The units of the product being sold (L25 / F3b).
 *
 * Presentational on purpose: the form owns the selection, the pending state and
 * the validation, and this component only shows them and reports a toggle. That
 * keeps the single source of truth — what is selected **is** the quantity — in
 * one place, and lets the same list be rendered by a future sale from another
 * screen without dragging an effect or a second state along.
 *
 * The count is the number the person checks against the sale: `2 de 5
 * unidades` says how many units leave and how many are still offered. Nothing
 * here is called a product-specific name (L18): they are unidades.
 */
export function MovementSaleUnits({
	product,
	units,
	isPending,
	isError,
	selectedUnitIds,
	onToggleUnit,
	error,
	disabled,
}: {
	product: Product | undefined;
	units: ProductUnit[] | undefined;
	isPending: boolean;
	isError: boolean;
	selectedUnitIds: string[];
	onToggleUnit: (unitId: string) => void;
	error: string | undefined;
	disabled: boolean;
}) {
	const selectedCount = selectedUnitIds.length;

	return (
		<section
			data-slot="movement-sale-units"
			aria-label={SALE_UNITS_LABEL}
			className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-surface-muted/40 p-4 md:col-span-full xl:col-span-1 2xl:col-span-full"
		>
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium text-text-primary">
					{SALE_UNITS_LABEL}
				</p>
				<p className="text-xs text-text-muted">
					Elegí una unidad por cada unidad que sale. La cantidad son las
					unidades que elijas.
				</p>
			</div>

			{isPending ? (
				<p className="text-sm text-text-secondary">{LOADING}</p>
			) : isError ? (
				<p role="alert" className="text-sm text-danger-text">
					{LOAD_ERROR}
				</p>
			) : !units || units.length === 0 ? (
				<p className="text-sm text-text-secondary">{NO_UNITS}</p>
			) : (
				<>
					<ul className="flex min-w-0 flex-col gap-2">
						{units.map((unit) => (
							<li key={unit.id} className="min-w-0">
								<Checkbox
									label={unitLabel(unit, product)}
									name={`unit-${unit.id}`}
									checked={selectedUnitIds.includes(unit.id)}
									onChange={() => onToggleUnit(unit.id)}
									disabled={disabled}
								/>
							</li>
						))}
					</ul>
					<p aria-live="polite" className="text-sm text-text-secondary">
						{selectedCount} de {units.length} unidades
					</p>
				</>
			)}

			{/* El mensaje lo decide el formulario y se muestra siempre que exista: si
			    la lectura falló, es lo que explica por qué la venta no puede seguir. */}
			{error ? (
				<p role="alert" className="text-xs text-danger-text">
					{error}
				</p>
			) : null}
		</section>
	);
}
