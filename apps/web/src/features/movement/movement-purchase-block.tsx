"use client";

import { useId } from "react";
import {
	AutoComplete,
	TextareaField,
	TextField,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/api/schemas";
import { parseMeasures } from "@/src/features/lot/lib/parse-measures";
import {
	formatMeasure,
	summarizePurchase,
} from "@/src/features/lot/lib/purchase-summary";
import type {
	PurchaseFormErrors,
	PurchaseFormValues,
} from "@/src/features/lot/lib/validate-purchase";
import { formatPrice } from "@/src/features/product/lib/format-price";
import { measureUnitLabel } from "@/src/features/product/lib/measure-unit";
import { useProviders } from "@/src/features/provider/api/use-providers";

/** The disclosure's label, and the name the tests and the copy share. */
export const PURCHASE_TOGGLE_LABEL = "Registrar compra por medida";

/** The label of the price field when no product was chosen yet. */
const GENERIC_UNIT = "medida";

/**
 * The label of the price box: "$ por kg" (or litre, or metre) once a product is
 * chosen (L20).
 *
 * `measureUnit` is how the product is **bought**, so it belongs to the purchase
 * price and nowhere near the sale price, which is per unit and never carries a
 * unit label.
 */
function costLabel(product: Product | undefined): string {
	return `$ por ${product ? measureUnitLabel(product.measureUnit) : GENERIC_UNIT}`;
}

function unitSuffix(product: Product | undefined): string {
	return product ? ` ${measureUnitLabel(product.measureUnit)}` : "";
}

/**
 * The purchase fields, which read the roster.
 *
 * It is its own component because `useProviders` only runs where the fields are
 * rendered: with the block closed the form never requests the supplier list.
 */
function PurchaseFields({
	id,
	companyId,
	product,
	values,
	onValueChange,
	errors,
	disabled,
}: {
	id: string;
	companyId: string | undefined;
	product: Product | undefined;
	values: PurchaseFormValues;
	onValueChange: (patch: Partial<PurchaseFormValues>) => void;
	errors: PurchaseFormErrors;
	disabled: boolean;
}) {
	const providers = useProviders(companyId);

	const options = (providers.data ?? []).map((provider) => ({
		value: provider.id,
		label: provider.name,
	}));

	// La aritmética de la pantalla es informativa (L21): el servidor deriva la
	// medida total del lote y reparte el costo de cada unidad.
	const parsed = parseMeasures(values.measures);
	const summary = parsed.ok
		? summarizePurchase(parsed.measures, values.costPerMeasure)
		: null;

	return (
		<div
			id={id}
			className="grid min-w-0 grid-cols-1 gap-4 rounded-md border border-border bg-surface-muted/40 p-4 sm:grid-cols-2"
		>
			<div className="flex min-w-0 flex-col gap-2 sm:col-span-full">
				<AutoComplete
					label="Proveedor"
					options={options}
					name="supplier"
					placeholder="Buscá el proveedor por nombre"
					emptyMessage="No hay proveedores que coincidan."
					value={values.supplierId}
					onValueChange={(value) => onValueChange({ supplierId: value })}
					disabled={disabled}
				/>
				{errors.supplierId ? (
					<p role="alert" className="text-xs text-danger-text">
						{errors.supplierId}
					</p>
				) : null}
			</div>

			<TextField
				label={costLabel(product)}
				name="costPerMeasure"
				inputMode="decimal"
				placeholder="5900.00"
				autoComplete="off"
				value={values.costPerMeasure}
				onChange={(event) =>
					onValueChange({ costPerMeasure: event.target.value })
				}
				error={errors.costPerMeasure}
				hint="Precio de compra de una medida, en pesos."
				disabled={disabled}
			/>

			<TextareaField
				label="Medida de cada unidad"
				name="measures"
				placeholder={"12,5\n13\n12,75"}
				value={values.measures}
				onChange={(event) => onValueChange({ measures: event.target.value })}
				error={errors.measures}
				hint="Una medida por unidad. Podés pegar la lista separada por líneas, espacios o punto y coma. Los decimales van con coma o con punto."
				disabled={disabled}
			/>

			<div
				className="flex min-w-0 flex-col gap-1 sm:col-span-full"
				aria-live="polite"
			>
				{summary ? (
					<>
						<p className="text-sm text-text-secondary">
							{summary.unitCount} unidades · Σ medida{" "}
							{formatMeasure(summary.measureTotal)}
							{unitSuffix(product)}
						</p>
						<p className="text-sm font-semibold text-text-primary">
							Total: {formatPrice(summary.total)}
						</p>
					</>
				) : (
					<p className="text-xs text-text-muted">
						El resumen aparece cuando completes el $ por {GENERIC_UNIT} y al
						menos una medida.
					</p>
				)}
			</div>
		</div>
	);
}

/**
 * The optional purchase block of the entry form (L21 / F2b).
 *
 * Closed by default, so an entry keeps being a loose entry: nothing is read and
 * nothing changes in what the form submits. Open, it asks for the supplier, the
 * price of one measure and the measure of each unit, and the form then registers
 * a **lot** (`POST /lots`) instead of a movement — the quantity *is* the number
 * of measures, which is why the form disables that field while this block is
 * open.
 *
 * It is controlled: the form owns the values and the open state, because the
 * submit path, the disabled quantity and the reset all depend on them. The
 * messages are Spanish and come from the same validation the submit runs, so
 * what the person sees while fixing the form is what blocks the submit.
 */
export function MovementPurchaseBlock({
	companyId,
	product,
	open,
	onOpenChange,
	values,
	onValueChange,
	errors,
	disabled,
}: {
	companyId: string | undefined;
	product: Product | undefined;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	values: PurchaseFormValues;
	onValueChange: (patch: Partial<PurchaseFormValues>) => void;
	errors: PurchaseFormErrors;
	disabled: boolean;
}) {
	const panelId = useId();

	return (
		<section
			data-slot="movement-purchase-block"
			aria-label={PURCHASE_TOGGLE_LABEL}
			className="flex min-w-0 flex-col gap-3 md:col-span-full xl:col-span-1 2xl:col-span-full"
		>
			<div className="flex flex-col gap-1">
				<Button
					type="button"
					variant="outline"
					className="h-10 w-full sm:w-auto sm:self-start"
					aria-expanded={open}
					aria-controls={panelId}
					disabled={disabled}
					onClick={() => onOpenChange(!open)}
				>
					{PURCHASE_TOGGLE_LABEL}
				</Button>
				{open ? null : (
					<p className="text-xs text-text-muted">
						Opcional: si la entrada es una compra con proveedor y medida, el
						lote se registra desde acá.
					</p>
				)}
			</div>

			{open ? (
				<PurchaseFields
					id={panelId}
					companyId={companyId}
					product={product}
					values={values}
					onValueChange={onValueChange}
					errors={errors}
					disabled={disabled}
				/>
			) : null}
		</section>
	);
}
