import type {
	IdentityProvider,
	IdentityTokens,
} from "../ports/identity-provider.js";

export interface RefreshSessionInput {
	refreshToken: string;
}

export interface RefreshSessionDependencies {
	identityProvider: IdentityProvider;
}

/**
 * Exchanges a refresh token for a fresh token pair through the identity
 * provider port.
 *
 * It is deliberately thin: the refresh token is an opaque credential handed to
 * the provider verbatim, and the email gate and user persistence already ran
 * at login. The HTTP layer owns reading the cookie, rotating it and clearing
 * it on rejection — this use case only brokers the exchange.
 */
export class RefreshSessionUseCase {
	private readonly identityProvider: IdentityProvider;

	constructor(dependencies: RefreshSessionDependencies) {
		this.identityProvider = dependencies.identityProvider;
	}

	async execute(input: RefreshSessionInput): Promise<IdentityTokens> {
		return this.identityProvider.refreshTokens(input.refreshToken);
	}
}
