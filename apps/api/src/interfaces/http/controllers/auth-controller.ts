import type { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { parse } from "valibot";
import type { LoginWithCredentialsUseCase } from "../../../application/use-cases/login-with-credentials.js";
import { loginSchema } from "../validators/auth-validator.js";

/**
 * Name of the cookie that carries the refresh token. It is `httpOnly`, so an
 * XSS cannot read the long-lived session; the access token stays in the JSON
 * body for the SPA's `Authorization: Bearer` header.
 */
export const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

/**
 * Lifetime of the refresh-token cookie: 30 days.
 *
 * It mirrors Auth0's default refresh-token lifetime for the Resource Owner
 * Password grant. Align it with the tenant's token-lifetime settings at deploy
 * time so the cookie does not outlive the token it holds.
 */
export const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cookie options for the refresh token. Injected from the composition root
 * (not read from the environment here) so tests can exercise both the
 * production (`secure: true`) and non-production (`secure: false`) modes.
 */
export interface AuthCookieOptions {
	httpOnly: boolean;
	secure: boolean;
	sameSite: "lax" | "strict" | "none";
	path: string;
	maxAge: number;
}

export interface AuthControllerDependencies {
	loginWithCredentials: LoginWithCredentialsUseCase;
	cookieOptions: AuthCookieOptions;
}

export interface AuthController {
	login: RequestHandler;
}

export function createAuthController(
	dependencies: AuthControllerDependencies,
): AuthController {
	return {
		login: async (request, response, next) => {
			try {
				const input = parse(loginSchema, request.body);
				const tokens = await dependencies.loginWithCredentials.execute(input);

				if (tokens.refreshToken !== undefined) {
					response.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, {
						httpOnly: dependencies.cookieOptions.httpOnly,
						secure: dependencies.cookieOptions.secure,
						sameSite: dependencies.cookieOptions.sameSite,
						path: dependencies.cookieOptions.path,
						maxAge: dependencies.cookieOptions.maxAge,
					});
				}

				// Never forward the provider's raw payload: the response body is
				// exactly these two fields.
				response.status(StatusCodes.OK).json({
					accessToken: tokens.accessToken,
					expiresIn: tokens.expiresIn,
				});
			} catch (error) {
				next(error);
			}
		},
	};
}
