import * as v from "valibot";
import {
	LOT_NOTE_MAX_LENGTH,
	MAX_LOT_UNITS,
} from "../../../domain/entities/stock-lot.js";
import { MeasureTotalDerivedError } from "../../../domain/errors/measure-total-derived-error.js";

/**
 * `costPerMeasure` travels as a **string**, exactly like the product price: the
 * column is `Decimal(12,2)` and a float would lose precision at the first
 * rounding. The regex is the frozen one from the OpenAPI contract, and it
 * accepts fewer decimals than the column stores on purpose -- the entity pads
 * them (`"5900"` -> `"5900.00"`), so the client never has to.
 */
const costPerMeasureSchema = v.pipe(
	v.string(),
	v.regex(
		/^\d{1,10}(\.\d{1,2})?$/,
		"costPerMeasure must be a decimal string with up to ten integer digits and up to two decimals",
	),
	v.check(
		(value) => Number(value) > 0,
		"costPerMeasure must be greater than 0",
	),
);

/**
 * `measure` arrives as a JSON number, because the client types a weight next to
 * a unit and the chart of the lot is an array of them. Which values the column
 * can store is still the exact rule of `Decimal(12,3)`: a positive value with at
 * most nine integer digits and at most three decimals. The check reads the
 * number's own notation (`String(84.5)` -> `"84.5"`), never `value * 1000`,
 * which is not guaranteed to be an integer.
 */
const measureSchema = v.pipe(
	v.number("each measure must be a number"),
	v.check(
		(value) => /^\d{1,9}(\.\d{1,3})?$/.test(String(value)),
		"each measure must be a positive decimal with up to nine integer digits and up to three decimals",
	),
	v.check((value) => value > 0, "each measure must be greater than 0"),
);

const measuresSchema = v.pipe(
	v.array(measureSchema),
	v.minLength(1, "measures must have at least one unit"),
	v.maxLength(
		MAX_LOT_UNITS,
		`measures must have at most ${MAX_LOT_UNITS} units`,
	),
);

/**
 * An absent `receivedAt` means "the lot arrived now": the entity defaults it to
 * its own clock, so the client never decides when the row was created.
 */
const receivedAtSchema = v.pipe(
	v.string(),
	v.check(
		(value) => !Number.isNaN(Date.parse(value)),
		"receivedAt must be a date-time",
	),
	v.transform((value) => new Date(value)),
);

const noteSchema = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(
		LOT_NOTE_MAX_LENGTH,
		`note must be at most ${LOT_NOTE_MAX_LENGTH} characters`,
	),
);

/**
 * Request schema for `POST /companies/:companyId/lots`.
 *
 * Only the writable fields exist here, so an unknown body key never reaches the
 * use case. The company never comes from the body: it comes from the resolved
 * company context.
 *
 * `measureTotal` is the exception to "unknown keys are dropped": it is a field
 * the client is likely to send, and silently ignoring it would leave the caller
 * believing its total was stored when the units say otherwise (L6). The check
 * runs **before** the object parse, on the raw body, and throws a domain error
 * the error handler maps to a coded 400 -- the same pattern the movement
 * validator uses for `customer_requires_exit`.
 */
export const createLotSchema = v.pipe(
	v.custom<unknown>((input) => {
		if (
			typeof input === "object" &&
			input !== null &&
			Object.hasOwn(input, "measureTotal")
		) {
			throw new MeasureTotalDerivedError();
		}

		return true;
	}, "measureTotal must not be sent"),
	v.object({
		productId: v.pipe(v.string(), v.uuid("productId must be a uuid")),
		supplierId: v.pipe(v.string(), v.uuid("supplierId must be a uuid")),
		costPerMeasure: costPerMeasureSchema,
		measures: measuresSchema,
		receivedAt: v.optional(receivedAtSchema),
		note: v.optional(v.nullable(noteSchema)),
	}),
);
