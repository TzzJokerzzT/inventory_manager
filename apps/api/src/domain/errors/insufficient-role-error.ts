/**
 * Raised when the caller's role in a company cannot perform the requested
 * member-management action (docs/stack.md §5.8 authorization matrix).
 *
 * The caller *is* a member (an ACTIVE membership resolved the company
 * context), so this is not the uniform `company_access_forbidden` denial: it
 * is a role problem, and it is safe to tell the caller which it was. The HTTP
 * layer owns the 403 mapping and the body shape.
 */
const MESSAGE = "Insufficient role for this action";

/**
 * Machine-readable discriminator the web client can use to tell this 403 apart
 * from `company_access_forbidden`, `email_not_verified` and
 * `user_not_provisioned`.
 */
export const INSUFFICIENT_ROLE_CODE = "insufficient_role";

export class InsufficientRoleError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "InsufficientRoleError";
	}
}

export const INSUFFICIENT_ROLE_MESSAGE = MESSAGE;
