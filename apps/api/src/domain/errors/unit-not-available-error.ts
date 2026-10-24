/**
 * Raised when a sale names a unit the store cannot hand over.
 *
 * It covers every reason at once -- the unit does not exist, it was already
 * sold, or it belongs to another product or another company -- because the
 * answer must not tell the caller which one it was: naming a foreign unit is
 * indistinguishable from naming a unit that does not exist (no leak of another
 * company's rows).
 *
 * Like the stock guard, it is the outcome of a **guarded write**: the units are
 * marked `SOLD` with `status: AVAILABLE` in the WHERE, so two concurrent sales
 * of the same roll cannot both win and the loser rolls the whole transaction
 * back (L10, MOV-04).
 */
const MESSAGE = "One or more units are not available for this product";

export const UNIT_NOT_AVAILABLE_CODE = "unit_not_available";

export class UnitNotAvailableError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "UnitNotAvailableError";
	}
}

export const UNIT_NOT_AVAILABLE_MESSAGE = MESSAGE;
