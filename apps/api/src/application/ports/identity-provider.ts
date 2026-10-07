/**
 * Port for exchanging credentials for tokens with an external identity
 * provider (Auth0).
 *
 * It lives under `application/ports` and not under `domain/repositories`
 * because the domain has no concept of an identity provider: only the login
 * use case needs to exchange credentials, so the abstraction belongs to the
 * application layer. The concrete Auth0 adapter lives in
 * `infrastructure/auth0/`, just like the Prisma adapter lives in
 * `infrastructure/database/`.
 */
export interface IdentityProviderCredentials {
	email: string;
	password: string;
}

export interface IdentityTokens {
	accessToken: string;
	refreshToken?: string;
	expiresIn: number;
}

/**
 * The identity of a person as reported by the identity provider, read back
 * with the access token the provider just issued.
 *
 * `emailVerified` is always a boolean: a missing `email_verified` in the
 * provider payload is treated as `false` (absence of proof is not proof).
 */
export interface Identity {
	auth0Sub: string;
	email: string;
	emailVerified: boolean;
}

export interface IdentityProvider {
	exchangePasswordCredentials(
		credentials: IdentityProviderCredentials,
	): Promise<IdentityTokens>;

	/**
	 * Exchanges a refresh token for a fresh token pair
	 * (`grant_type=refresh_token`).
	 *
	 * The returned `refreshToken` is only present when the provider rotates
	 * the refresh token; a `200` that carries no access token is mapped by the
	 * adapter to `IdentityProviderUnavailableError` rather than resolving as a
	 * success.
	 */
	refreshTokens(refreshToken: string): Promise<IdentityTokens>;

	/**
	 * Creates an account in the provider's user database.
	 *
	 * The caller gets nothing meaningful back: a rejection is reported as a
	 * dedicated error whose message is a fixed constant, and the HTTP layer
	 * turns both success and rejection into the same uniform response.
	 */
	signUp(credentials: IdentityProviderCredentials): Promise<void>;

	/**
	 * Reads the verified identity behind an access token.
	 *
	 * Any failure — including a provider rejection — maps to
	 * `IdentityProviderUnavailableError`: the person already authenticated
	 * successfully, so failing to read the profile is our problem, not
	 * "invalid credentials".
	 */
	getIdentity(accessToken: string): Promise<Identity>;
}
