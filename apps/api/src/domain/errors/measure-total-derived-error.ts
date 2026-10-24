/**
 * Raised when a request tries to send the lot's `measureTotal`.
 *
 * L6 of `odd/tasks/suppliers-lots-costing.md` derives the total from the units'
 * measures, so it is not a writable field: a typed total could disagree with
 * the very units it is supposed to summarize, and the invariant "the units add
 * up to the lot" would stop being true by construction.
 *
 * It is not a malformed value (the number could be perfectly well formed) but a
 * field that does not belong to the request at all, which is why the HTTP layer
 * answers a coded 400 instead of a generic issue list.
 */
const MESSAGE =
	"measureTotal is derived from the units' measures and must not be sent";

/**
 * Machine-readable discriminator, so the client can point at the field it must
 * remove instead of parsing the message.
 */
export const MEASURE_TOTAL_DERIVED_CODE = "measure_total_derived";

export class MeasureTotalDerivedError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "MeasureTotalDerivedError";
	}
}

export const MEASURE_TOTAL_DERIVED_MESSAGE = MESSAGE;
