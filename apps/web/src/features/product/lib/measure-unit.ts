import type { MeasureUnit } from "@/lib/api/schemas";

/**
 * The unit a product is created with when nobody chose one: it is the API's
 * default, so the form starts where the server would end up.
 */
export const DEFAULT_MEASURE_UNIT: MeasureUnit = "KILOGRAM";

/**
 * The short label of each measure unit, for the price of a row.
 *
 * A closed record, not a lookup with a fallback: the boundary already rejects
 * an unknown `measureUnit`, so the type checker is what keeps a new unit from
 * reaching the table under a made-up symbol.
 */
const MEASURE_UNIT_LABELS: Record<MeasureUnit, string> = {
	KILOGRAM: "kg",
	LITRE: "L",
	METRE: "m",
};

/**
 * The options the form offers, in the order a person expects them. The labels
 * are Spanish because they are user-facing copy; the values are the contract's
 * raw enum, which is what the API stores.
 */
export const MEASURE_UNIT_OPTIONS: { value: MeasureUnit; label: string }[] = [
	{ value: "KILOGRAM", label: "Kilogramo" },
	{ value: "LITRE", label: "Litro" },
	{ value: "METRE", label: "Metro" },
];

const MEASURE_UNITS: readonly string[] = MEASURE_UNIT_OPTIONS.map(
	(option) => option.value,
);

/** Narrowing helper: keeps a value that came back from a select typed. */
export function isMeasureUnit(value: unknown): value is MeasureUnit {
	return typeof value === "string" && MEASURE_UNITS.includes(value);
}

/**
 * Names the unit a price per measure is expressed in.
 *
 * The price means nothing without it -- "$ 5.900,00" of what? -- so the table
 * renders both together, from the row the API answered.
 */
export function measureUnitLabel(unit: MeasureUnit): string {
	return MEASURE_UNIT_LABELS[unit];
}
