/**
 * Raised when a create or an update would give the company a second supplier
 * with the same name.
 *
 * Uniqueness is per company and includes the soft-deleted rows, because the
 * `@@unique([companyId, name])` index covers them: deleting a supplier reserves
 * its name (the same rule the product SKU follows). The HTTP layer owns the 409
 * mapping.
 */
const MESSAGE = "A supplier with that name already exists in the company";

/**
 * Machine-readable discriminator for clients that want to tell the conflict
 * apart from a malformed request or a role problem.
 */
export const SUPPLIER_NAME_ALREADY_EXISTS_CODE = "supplier_name_already_exists";

export class SupplierNameAlreadyExistsError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "SupplierNameAlreadyExistsError";
	}
}

export const SUPPLIER_NAME_ALREADY_EXISTS_MESSAGE = MESSAGE;
