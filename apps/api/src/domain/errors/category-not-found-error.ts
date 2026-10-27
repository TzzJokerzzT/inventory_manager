/**
 * Raised when a category id does not resolve inside the company the caller
 * already has context for.
 *
 * The company context (an ACTIVE membership) was already proven before any
 * handler runs, so this 404 leaks nothing: a category id belonging to another
 * company, a deleted one and a nonexistent one are answered identically, which
 * is what stops the endpoint from probing other companies' category ids (S4).
 */
const MESSAGE = "Category not found";

/**
 * Machine-readable discriminator, mirroring `supplier_not_found`: the client
 * keys on the code, never on the human-facing message.
 */
export const CATEGORY_NOT_FOUND_CODE = "category_not_found";

export class CategoryNotFoundError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "CategoryNotFoundError";
	}
}

export const CATEGORY_NOT_FOUND_MESSAGE = MESSAGE;
