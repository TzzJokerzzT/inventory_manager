/**
 * Raised when a membership id does not resolve inside the company the caller
 * already has context for.
 *
 * The company context (an ACTIVE membership) was already proven before any
 * handler runs, so this 404 leaks nothing: a membership id belonging to another
 * company and a nonexistent one are answered identically, which is what stops
 * the endpoint from being used to probe other companies' membership ids.
 */
const MESSAGE = "Membership not found";

export const MEMBERSHIP_NOT_FOUND_CODE = "membership_not_found";

export class MembershipNotFoundError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "MembershipNotFoundError";
	}
}

export const MEMBERSHIP_NOT_FOUND_MESSAGE = MESSAGE;
