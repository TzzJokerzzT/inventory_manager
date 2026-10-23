/**
 * Raised when a customer id does not resolve inside the company the caller
 * already has context for.
 *
 * The company context (an ACTIVE membership) was already proven before any
 * handler runs, so this 404 leaks nothing: a customer id belonging to another
 * company, a soft-deleted one and a nonexistent one are answered identically,
 * which is what stops the endpoint from probing other companies' customer ids
 * (S5).
 */
const MESSAGE = "Customer not found";

export const CUSTOMER_NOT_FOUND_CODE = "customer_not_found";

export class CustomerNotFoundError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "CustomerNotFoundError";
	}
}

export const CUSTOMER_NOT_FOUND_MESSAGE = MESSAGE;
