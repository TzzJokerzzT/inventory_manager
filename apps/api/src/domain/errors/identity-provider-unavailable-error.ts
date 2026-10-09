/**
 * Fixed message returned when the identity provider cannot be reached or
 * answers with a server error.
 */
const MESSAGE = "Identity provider unavailable";

/**
 * Raised when the identity provider is down, times out, or answers 5xx. It
 * carries no HTTP concern: the HTTP layer maps it to 503, so the client is
 * not lied to with a 401 that would send them to "check your password".
 */
export class IdentityProviderUnavailableError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "IdentityProviderUnavailableError";
	}
}
