import { SignUpRejectedError } from "../../domain/errors/sign-up-rejected-error.js";
import type { IdentityProvider } from "../ports/identity-provider.js";

export interface RegisterUserInput {
	email: string;
	password: string;
}

export interface RegisterUserDependencies {
	identityProvider: IdentityProvider;
}

/**
 * Creates an account through the identity provider port.
 *
 * It owns the only normalization applied to the email: `trim()` removes
 * surrounding whitespace. The value is deliberately **not** lowercased — the
 * email is the credential handed to the provider verbatim, so lowercasing here
 * could break an account that was registered with capital letters (the
 * lowercasing happens later, on the persisted value, and is owned by the user
 * entity).
 */
export class RegisterUserUseCase {
	private readonly identityProvider: IdentityProvider;

	constructor(dependencies: RegisterUserDependencies) {
		this.identityProvider = dependencies.identityProvider;
	}

	async execute(input: RegisterUserInput): Promise<void> {
		const email = input.email.trim();

		try {
			await this.identityProvider.signUp({
				email,
				password: input.password,
			});
		} catch (error) {
			// Auth0 answers `invalid_signup` both for a duplicate email and for
			// a rejected password, and deliberately does not say which one it
			// was. Telling the client which it was would leak whether an
			// address is already registered, so the acceptance criteria forbid
			// it: a rejection is therefore **not** an error for the caller and
			// is swallowed exactly like a success — the HTTP layer turns both
			// into the same uniform 201. If this looks like a bug, resist the
			// urge to "fix" it by re-throwing: the adapter already logged the
			// provider's detail server-side, and any divergence between the two
			// outcomes is the information leak we must not create. Every other
			// failure (provider unavailable) must still propagate.
			if (error instanceof SignUpRejectedError) {
				return;
			}

			throw error;
		}
	}
}
