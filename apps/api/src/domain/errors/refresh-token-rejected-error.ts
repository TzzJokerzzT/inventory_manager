/**
 * Fixed message returned for every failed refresh, uniform by construction: a
 * missing cookie and a rejected refresh token are the same thing to the caller
 * — sign in again. It can never be derived from what the identity provider
 * returned, exactly like `InvalidCredentialsError`'s message.
 */
export const REFRESH_TOKEN_REJECTED_MESSAGE = "Please sign in again";

/**
 * Raised when the identity provider rejects the refresh token (4xx). It
 * carries no HTTP concern: the HTTP layer maps it to a 401 and clears the
 * refresh cookie so the client does not retry with a dead token. A missing
 * cookie is answered with the same uniform message, but without clearing —
 * there is nothing to clear.
 */
export class RefreshTokenRejectedError extends Error {
	constructor() {
		super(REFRESH_TOKEN_REJECTED_MESSAGE);
		this.name = "RefreshTokenRejectedError";
	}
}
