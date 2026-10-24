/**
 * The cap the API applies to a purchase: one lot holds at most 500 physical
 * units (`MAX_LOT_UNITS` in the domain). Mirrored here so a pasted list the
 * server would reject never leaves the browser.
 */
export const MAX_LOT_UNITS = 500;

/** The decimals the API stores for a measure (`Decimal(12,3)`). */
export const MAX_MEASURE_DECIMALS = 3;

/**
 * The result of reading the measure box: the list, or the message to show.
 *
 * A discriminated union instead of an exception because both outcomes are
 * normal: the box is read on every keystroke to draw the live summary, and a
 * half-typed list is not an error until the person submits.
 */
export type ParseMeasuresResult =
	| { ok: true; measures: number[] }
	| { ok: false; message: string };

/**
 * A token the API accepts for one measure: a non-negative decimal with at most
 * three decimals (`Decimal(12,3)`), with **either** separator for the decimals.
 *
 * The comma is accepted as the decimal separator, not as a list separator: this
 * interface is Spanish, and "12,5" is how a person writes twelve and a half. A
 * parser that read it as two units (12 and 5) would invent stock and cost from
 * an ordinary input, silently. Lists are separated by lines, spaces or
 * semicolons, which is what a pasted column and a semicolon-separated export
 * actually look like.
 */
const MEASURE_TOKEN = /^\d{1,9}([.,]\d{1,3})?$/;

const EMPTY = "Ingresá la medida de cada unidad.";
const TOO_MANY = `Un lote admite hasta ${MAX_LOT_UNITS} unidades.`;

/**
 * Reads the pasted list of measures, one per unit.
 *
 * Newlines, spaces and semicolons separate values: the box exists to paste a
 * list, and the lists people paste come from a copied column (newlines or
 * spaces) or a semicolon-separated export. Blank fragments — an empty line, a
 * double space — are separators, not values.
 *
 * A comma is **part of a value**, never a separator (see `MEASURE_TOKEN`), so a
 * token with two commas is reported instead of being split into two measures
 * nobody typed: the ambiguous case becomes a message, not silent data.
 *
 * A token that is not a measure is reported **with the token**: the list can be
 * long, and "revisá la lista" leaves the person counting commas. The count cap
 * is checked after parsing so the message about 500 units wins over a per-token
 * error when both apply.
 */
export function parseMeasures(input: string): ParseMeasuresResult {
	const tokens = input
		.split(/[\s;]+/)
		.map((token) => token.trim())
		// A fragment made only of separators (a stray comma, a doubled semicolon)
		// is a blank left by the paste, not a measure to complain about.
		.filter((token) => token !== "" && !/^[,;]+$/.test(token));

	if (tokens.length === 0) {
		return { ok: false, message: EMPTY };
	}

	if (tokens.length > MAX_LOT_UNITS) {
		return { ok: false, message: TOO_MANY };
	}

	const measures: number[] = [];
	for (const token of tokens) {
		if (!MEASURE_TOKEN.test(token) || Number(token) <= 0) {
			return {
				ok: false,
				message: `Revisá «${token}»: cada medida tiene que ser mayor que cero, con hasta ${MAX_MEASURE_DECIMALS} decimales.`,
			};
		}
		// `Number` reads "12.5" and not "12,5", so the accepted comma is normalized
		// here, at the single point where a token becomes a measure.
		measures.push(Number(token.replace(",", ".")));
	}

	return { ok: true, measures };
}
