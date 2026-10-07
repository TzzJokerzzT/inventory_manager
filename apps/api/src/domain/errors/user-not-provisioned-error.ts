/**
 * Fixed message returned when a valid token cannot be resolved to a `users`
 * row.
 *
 * It carries no HTTP concern: the HTTP layer maps it to 403 and attaches the
 * machine-readable `user_not_provisioned` code the web client can use to tell
 * this failure apart from other 403s.
 */
const MESSAGE = "User not provisioned";

/**
 * Raised when a request carries a valid access token whose `sub` has no
 * corresponding `users` row. Only our API issues tokens, and the MI-53 gate
 * creates the row before issuing them, so a valid token without a row means
 * something is inconsistent and must not be silently tolerated: answering
 * 403 here is cheaper to debug than inventing a user.
 */
export class UserNotProvisionedError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "UserNotProvisionedError";
	}
}
