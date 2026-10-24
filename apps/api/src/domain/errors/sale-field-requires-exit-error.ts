/**
 * The fields only a sale may carry: the written price (S1) and the units it
 * takes (S2).
 */
export type SaleField = "unitPrice" | "unitIds";

/**
 * Raised when a sale-only field is sent with a movement that is not an exit.
 *
 * It mirrors {@link import("./customer-requires-exit-error.js").CustomerRequiresExitError}:
 * an entry is a purchase from a supplier, so it has no customer, no price
 * written by the seller and no rolls chosen. Accepting the field silently would
 * let the caller believe a price or a unit link was stored when it was not.
 *
 * The rule is enforced at the edge (the validator answers 400 without reaching
 * the use case) and re-checked in the use case as defence in depth, so a
 * non-HTTP caller gets the same rejection. The HTTP layer owns the 400 mapping;
 * the per-field code lets the client point at the field it must remove.
 */
export const UNIT_PRICE_REQUIRES_EXIT_CODE = "unit_price_requires_exit";
export const UNITS_REQUIRE_EXIT_CODE = "units_require_exit";

export function saleFieldRequiresExitMessage(field: SaleField): string {
	return `${field} can only be sent with an exit (OUT) movement`;
}

export class SaleFieldRequiresExitError extends Error {
	readonly field: SaleField;

	constructor(field: SaleField) {
		super(saleFieldRequiresExitMessage(field));
		this.name = "SaleFieldRequiresExitError";
		this.field = field;
	}

	/** The machine-readable discriminator of the field that was rejected. */
	get code(): string {
		return this.field === "unitPrice"
			? UNIT_PRICE_REQUIRES_EXIT_CODE
			: UNITS_REQUIRE_EXIT_CODE;
	}
}
