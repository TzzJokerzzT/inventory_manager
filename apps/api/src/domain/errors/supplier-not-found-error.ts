/**
 * Raised when a supplier id does not resolve inside the company the caller
 * already has context for.
 *
 * The company context (an ACTIVE membership) was already proven before any
 * handler runs, so this 404 leaks nothing: a supplier id belonging to another
 * company, a soft-deleted one and a nonexistent one are answered identically,
 * which is what stops the endpoint from probing other companies' supplier ids
 * (EMP-03).
 */
const MESSAGE = "Supplier not found";

/**
 * Machine-readable discriminator, mirroring `customer_not_found`: the client
 * keys on the code, never on the human-facing message.
 */
export const SUPPLIER_NOT_FOUND_CODE = "supplier_not_found";

export class SupplierNotFoundError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "SupplierNotFoundError";
	}
}

export const SUPPLIER_NOT_FOUND_MESSAGE = MESSAGE;
