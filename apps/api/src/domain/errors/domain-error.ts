/**
 * Error raised when a domain rule is violated.
 *
 * It carries no HTTP concern on purpose: the HTTP layer decides how to map it
 * to a status code.
 */
export class DomainError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DomainError";
	}
}
