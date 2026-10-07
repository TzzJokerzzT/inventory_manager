/**
 * Fixed message returned for every failed credential exchange.
 *
 * It is a constant on purpose: a wrong password and a non-existent account
 * must be indistinguishable from the outside, so uniformity holds by
 * construction — the message can never be derived from what the identity
 * provider returned.
 */
const MESSAGE = "Invalid credentials";

/**
 * Raised when the identity provider rejects the supplied credentials (4xx).
 * It carries no HTTP concern: the HTTP layer maps it to 401.
 */
export class InvalidCredentialsError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "InvalidCredentialsError";
	}
}
