/**
 * Raised when an operation would leave a company with no active OWNER.
 *
 * `docs/stack.md` §5.8, invariant 4: every company keeps at least one active
 * OWNER, because a company with none is an unrecoverable state -- nobody left
 * can assign the role back. The HTTP layer maps this to a 409: the request is
 * well-formed and the caller may even be allowed to manage members, but the
 * result would break a domain invariant.
 *
 * It is deliberately not folded into `insufficient_role`: that one is about who
 * the caller is, this one is about what the company would become.
 */
const MESSAGE = "The company would be left without an active OWNER";

export const LAST_ACTIVE_OWNER_CODE = "last_active_owner";

export class LastActiveOwnerError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "LastActiveOwnerError";
	}
}

export const LAST_ACTIVE_OWNER_MESSAGE = MESSAGE;
