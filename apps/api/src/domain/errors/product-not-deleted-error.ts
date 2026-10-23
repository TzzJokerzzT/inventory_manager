/**
 * Raised when a restore is asked for a product that is not in the trash.
 *
 * The trash is a *state*, not a flag (odd/tasks/product-restore.md L2), so
 * restoring an active product is a conflict and not an idempotent no-op: the
 * caller learns that the state was not the one it believed. The HTTP layer
 * owns the 409 mapping.
 */
const MESSAGE = "Product is not deleted";

/**
 * Machine-readable discriminator for clients that want to distinguish the
 * conflict from a malformed request or a role problem.
 */
export const PRODUCT_NOT_DELETED_CODE = "product_not_deleted";

export class ProductNotDeletedError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "ProductNotDeletedError";
	}
}

export const PRODUCT_NOT_DELETED_MESSAGE = MESSAGE;
