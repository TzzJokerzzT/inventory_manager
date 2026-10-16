import { EmailNotVerifiedError } from "../../domain/errors/email-not-verified-error.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";
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
	userRepository: UserRepository;
}

/**
 * Exchanges credentials for tokens through the identity provider port, then
 * enforces the verified-email gate and persists the user row.
 *
 * It owns the only normalization applied to the email: `trim()` removes
 * surrounding whitespace, but the value is deliberately **not** lowercased.
 * The email is the credential, so it must be handed to the provider verbatim —
 * lowercasing here could break an account that was registered with capital
 * letters. The lowercased, persisted value is owned by the user entity, not by
 * this use case.
 */
export class LoginWithCredentialsUseCase {
	private readonly identityProvider: IdentityProvider;
	private readonly userRepository: UserRepository;

	constructor(dependencies: LoginWithCredentialsDependencies) {
		this.identityProvider = dependencies.identityProvider;
		this.userRepository = dependencies.userRepository;
	}

	async execute(input: LoginWithCredentialsInput): Promise<IdentityTokens> {
		const email = input.email.trim();

		const tokens = await this.identityProvider.exchangePasswordCredentials({
			email,
			password: input.password,
		});

		const identity = await this.identityProvider.getIdentity(
			tokens.accessToken,
		);

		if (!identity.emailVerified) {
			// A user who just proved their password may be told to verify their
			// email — that is not a leak. But issuing tokens here would defeat
			// the invariant: our protected routes only validate signature,
			// issuer and audience, so an unverified token would be accepted
			// everywhere. Therefore no tokens are returned and no user row is
			// created; the HTTP layer maps this to a 403 with
			// `email_not_verified`.
			throw new EmailNotVerifiedError();
		}

		await this.userRepository.upsertFromIdentity({
			auth0Sub: identity.auth0Sub,
			email: identity.email,
		});

		return tokens;
	}
}
