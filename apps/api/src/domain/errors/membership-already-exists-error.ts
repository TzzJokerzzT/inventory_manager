/**
 * Raised when an invitation targets an email that already has an ACTIVE or
 * INVITED membership in the same company.
 *
 * A REVOKED membership never matches: revoking frees the email to be invited
 * again. The HTTP layer owns the 409 mapping and the body shape.
 */
const MESSAGE = "The user is already a member or has a pending invitation";

/**
 * Machine-readable discriminator for clients that want to distinguish a
 * duplicate invitation from a malformed request.
 */
export const MEMBERSHIP_ALREADY_EXISTS_CODE = "membership_already_exists";

export class MembershipAlreadyExistsError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "MembershipAlreadyExistsError";
	}
}

export const MEMBERSHIP_ALREADY_EXISTS_MESSAGE = MESSAGE;
