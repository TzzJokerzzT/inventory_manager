/**
 * Fixed, uniform response for every denied company access, no matter the cause.
 *
 * "Company does not exist" and "user is not a member" must be indistinguishable
 * from the outside: telling them apart would turn the endpoint into an oracle
 * that enumerates which company ids exist (docs/stack.md §5.8, invariant 1).
 * The message is therefore a constant and never derived from what the
 * membership lookup returned.
 */
const MESSAGE = "Company access forbidden";

export const COMPANY_CONTEXT_FORBIDDEN_MESSAGE = MESSAGE;

/**
 * Machine-readable discriminator the web client can use to tell this 403 apart
 * from the other forbidden responses (`email_not_verified`,
 * `user_not_provisioned`).
 */
export const COMPANY_CONTEXT_FORBIDDEN_CODE = "company_access_forbidden";

/**
 * Raised when a request's `companyId` does not resolve to an ACTIVE membership
 * for the resolved user.
 *
 * It carries no HTTP concern: the HTTP layer owns the 403 mapping and the body
 * shape. The constants above are the single source of truth the middleware and
 * controller both use, so the two denied branches can never drift.
 */
export class CompanyContextForbiddenError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "CompanyContextForbiddenError";
	}
}
