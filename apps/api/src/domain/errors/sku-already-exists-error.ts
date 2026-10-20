/**
 * Raised when a create or update would give the company a second product with
 * the same SKU.
 *
 * Uniqueness is per company and includes the soft-deleted rows, because the
 * `@@unique([companyId, sku])` index covers them: deleting a product reserves
 * its SKU (odd/tasks/products.md L7). The HTTP layer owns the 409 mapping.
 */
const MESSAGE = "A product with that SKU already exists in the company";

/**
 * Machine-readable discriminator for clients that want to distinguish the
 * conflict from a malformed request or a role problem.
 */
export const SKU_ALREADY_EXISTS_CODE = "sku_already_exists";

export class SkuAlreadyExistsError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "SkuAlreadyExistsError";
	}
}

export const SKU_ALREADY_EXISTS_MESSAGE = MESSAGE;
