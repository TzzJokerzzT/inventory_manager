/**
 * Raised when a product id does not resolve inside the company the caller
 * already has context for.
 *
 * The company context (an ACTIVE membership) was already proven before any
 * handler runs, so this 404 leaks nothing: a product id belonging to another
 * company, a soft-deleted one and a nonexistent one are answered identically,
 * which is what stops the endpoint from probing other companies' product ids.
 */
const MESSAGE = "Product not found";

export const PRODUCT_NOT_FOUND_CODE = "product_not_found";

export class ProductNotFoundError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "ProductNotFoundError";
	}
}

export const PRODUCT_NOT_FOUND_MESSAGE = MESSAGE;
