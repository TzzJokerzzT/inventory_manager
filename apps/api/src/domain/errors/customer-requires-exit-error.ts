/**
 * Raised when a customer is associated with a movement that is not an exit.
 *
 * A customer identifies the buyer of a sale (CLI-04), so an entry -- a purchase
 * from a supplier -- cannot carry one: accepting it silently would make the
 * customer's purchase history lie. The rule is enforced at the edge (the
 * validator answers 400 without reaching the use case) and re-checked in the
 * use case as defence in depth.
 *
 * The HTTP layer owns the 400 mapping; the code is what lets the client tell
 * this rejection apart from a malformed body.
 */
const MESSAGE = "A customer can only be associated with an exit (OUT)";

export const CUSTOMER_REQUIRES_EXIT_CODE = "customer_requires_exit";

export class CustomerRequiresExitError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "CustomerRequiresExitError";
	}
}

export const CUSTOMER_REQUIRES_EXIT_MESSAGE = MESSAGE;
