import type {
	IdentityProvider,
	IdentityTokens,
} from "../ports/identity-provider.js";

export interface LoginWithCredentialsInput {
	email: string;
	password: string;
}

export interface LoginWithCredentialsDependencies {
	identityProvider: IdentityProvider;
}

/**
 * Exchanges credentials for tokens through the identity provider port.
 *
 * It owns the only normalization applied to the email: `trim()` removes
 * surrounding whitespace, but the value is deliberately **not** lowercased.
 * The email is the credential, so it must be handed to the provider verbatim —
 * lowercasing here could break an account that was registered with capital
 * letters.
 */
export class LoginWithCredentialsUseCase {
	private readonly identityProvider: IdentityProvider;

	constructor(dependencies: LoginWithCredentialsDependencies) {
		this.identityProvider = dependencies.identityProvider;
	}

	async execute(input: LoginWithCredentialsInput): Promise<IdentityTokens> {
		const email = input.email.trim();

		return this.identityProvider.exchangePasswordCredentials({
			email,
			password: input.password,
		});
	}
}
