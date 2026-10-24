/**
 * Raised when a sale of a product **with available units** does not say which
 * units left, or at what price.
 *
 * L9 fixes the rule: a product loaded in purchase lots can only be sold with
 * `unitPrice` and with `unitIds` whose length matches the quantity, because
 * that pair is what sostains the real margin (S1, S3). A product that never
 * came in a lot keeps the quantity-only sale, so this error is never raised for
 * it.
 *
 * The decision is the adapter's, inside the same transaction that writes the
 * sale (L10): only the store knows whether the product has units available
 * right now. The HTTP layer owns the 400 mapping.
 */
const MESSAGE =
	"A sale of a product with available units requires unitPrice and unitIds matching the quantity";

export const UNITS_REQUIRED_CODE = "units_required";

export class UnitsRequiredError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "UnitsRequiredError";
	}
}

export const UNITS_REQUIRED_MESSAGE = MESSAGE;
