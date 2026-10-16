/**
 * Fixed message returned for a login whose email has not been verified.
 *
 * It carries no HTTP concern: the HTTP layer maps it to 403 and attaches the
 * machine-readable `email_not_verified` code the web client needs to tell this
 * failure apart from other 403s.
 */
const MESSAGE = "Email not verified";

/**
 * Raised when the identity provider reports `email_verified: false` after a
 * successful credential exchange. The person just proved their password, so
 * telling them to verify their email is not a leak — but no tokens and no user
 * row may be produced, because the protected routes only validate signature,
 * issuer and audience and would accept an unverified token everywhere.
 */
export class EmailNotVerifiedError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "EmailNotVerifiedError";
	}
}
