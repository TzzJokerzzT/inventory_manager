import type { RequestHandler } from "express";
import { auth } from "express-oauth2-jwt-bearer";

export interface RequireAuthOptions {
	/** Base URL of the issuer, with a trailing slash, e.g. `https://tenant.us.auth0.com/`. */
	issuerBaseURL: string;
	/** The API identifier the access token must be issued for. */
	audience: string;
}

/**
 * Builds the `requireAuth` middleware that validates bearer access tokens
 * against the issuer's JWKS. It is a factory so tests can point it at a local
 * issuer without touching the environment.
 */
export function createRequireAuth({
	issuerBaseURL,
	audience,
}: RequireAuthOptions): RequestHandler {
	return auth({ issuerBaseURL, audience });
}
