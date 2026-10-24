/**
 * How the bulk a product is bought in is measured (S6): a purchase lot of
 * plastic rolls arrives in kilograms, a lot of paint in litres.
 *
 * It describes the **measure of a lot**, never the stock: the stock keeps
 * counting whole units (S7), and the weight lives in the lot and in its units.
 * That is why the measure unit is carried by the product row (the catalogue
 * decides how its lots are expressed) and, since L19, also travels in the
 * product's JSON: the purchase form names the unit of a `$/measure` instead of
 * assuming kilograms.
 */
export type MeasureUnit = "KILOGRAM" | "LITRE" | "METRE";

const MEASURE_UNITS: readonly string[] = ["KILOGRAM", "LITRE", "METRE"];

/**
 * The value the column defaults to, and the one a product created before the
 * feature carries: S9 forbids inventing data, and "kilograms" is what the only
 * measured customers buy today.
 */
export const DEFAULT_MEASURE_UNIT: MeasureUnit = "KILOGRAM";

/** Narrows an arbitrary value to a measure unit the domain knows. */
export function isMeasureUnit(value: unknown): value is MeasureUnit {
	return typeof value === "string" && MEASURE_UNITS.includes(value);
}
