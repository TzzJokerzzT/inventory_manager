/**
 * Raised when a create or a rename would give the company a second category with
 * the same name.
 *
 * Uniqueness is per company and **case-sensitive**, because the
 * `@@unique([companyId, name])` index is: `Bebidas` and `bebidas` are two
 * categories (the same deliberate rule the supplier name follows). The HTTP
 * layer owns the 409 mapping.
 */
const MESSAGE = "A category with that name already exists in the company";

/**
 * Machine-readable discriminator for clients that want to tell the conflict
 * apart from a malformed request or a role problem.
 */
export const CATEGORY_NAME_ALREADY_EXISTS_CODE = "category_name_already_exists";

export class CategoryNameAlreadyExistsError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "CategoryNameAlreadyExistsError";
	}
}

export const CATEGORY_NAME_ALREADY_EXISTS_MESSAGE = MESSAGE;
