import type { SupplierLastLot } from "@/lib/api/schemas";

/**
 * The short label of each measure unit the contract allows.
 *
 * A closed record, not a lookup with a fallback: the boundary already rejects an
 * unknown `measureUnit`, so the type checker is what keeps a new unit from
 * reaching the roster under a made-up name.
 */
const MEASURE_UNIT_LABELS: Record<SupplierLastLot["measureUnit"], string> = {
	KILOGRAM: "kg",
	LITRE: "L",
	METRE: "m",
};

/**
 * Names the unit a `costPerMeasure` is expressed in.
 *
 * The price means nothing without its unit — "$ 5.900,00" of what? — so the
 * roster renders both together, from the lot the API answered, never from an
 * assumption about what the product is bought in.
 */
export function measureUnitLabel(unit: SupplierLastLot["measureUnit"]): string {
	return MEASURE_UNIT_LABELS[unit];
}
