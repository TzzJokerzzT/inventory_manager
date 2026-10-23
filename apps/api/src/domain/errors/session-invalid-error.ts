/**
 * Fixed message returned whenever a session can no longer be used: unknown,
 * revoked or idle past its window are the same thing to the caller — sign in
 * again — exactly like `RefreshTokenRejectedError`'s message.
 *
 * It is deliberately a separate error from `RefreshTokenRejectedError`: one
 * means "the provider refused the token" and the other "our own session said
 * no", and the HTTP layer answers both with the same uniform body while the
 * logs keep them apart.
 */
export const SESSION_INVALID_MESSAGE = "Please sign in again";

/**
 * Raised by the session use cases when the row is missing, revoked or idle
 * past the configured window. It carries no HTTP concern: the HTTP layer maps
 * it to the uniform 401 and clears both session cookies.
 */
export class SessionInvalidError extends Error {
	constructor() {
		super(SESSION_INVALID_MESSAGE);
		this.name = "SessionInvalidError";
	}
}
