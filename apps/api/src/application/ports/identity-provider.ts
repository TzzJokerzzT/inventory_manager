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

export interface IdentityProvider {
	exchangePasswordCredentials(
		credentials: IdentityProviderCredentials,
	): Promise<IdentityTokens>;
}
