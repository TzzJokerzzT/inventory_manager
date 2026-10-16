/**
 * Fixed message returned when the identity provider rejects a sign up (4xx).
 *
 * It is a constant on purpose: Auth0 answers `400 invalid_signup` both for a
 * duplicate email and for a rejected password, and deliberately does not say
 * which. Nothing the provider returned may leak into this message — the HTTP
 * layer turns it into the same uniform response as a success, and the actual
 * provider detail is logged server-side by the adapter.
 */
const MESSAGE = "Sign up rejected";

/**
 * Raised when the identity provider rejects a sign up request (4xx). It
 * carries no HTTP concern: the HTTP layer decides how to map it.
 */
export class SignUpRejectedError extends Error {
	constructor() {
		super(MESSAGE);
		this.name = "SignUpRejectedError";
	}
}
