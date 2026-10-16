import type { RequestHandler, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { parse } from "valibot";
import type { LoginWithCredentialsUseCase } from "../../../application/use-cases/login-with-credentials.js";
import type { RefreshSessionUseCase } from "../../../application/use-cases/refresh-session.js";
import type { RegisterUserUseCase } from "../../../application/use-cases/register-user.js";
import {
	REFRESH_TOKEN_REJECTED_MESSAGE,
	RefreshTokenRejectedError,
} from "../../../domain/errors/refresh-token-rejected-error.js";
import { loginSchema, registerSchema } from "../validators/auth-validator.js";

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
	registerUser: RegisterUserUseCase;
	refreshSession: RefreshSessionUseCase;
	cookieOptions: AuthCookieOptions;
}

export interface AuthController {
	login: RequestHandler;
	register: RequestHandler;
	refresh: RequestHandler;
	logout: RequestHandler;
}

export function createAuthController(
	dependencies: AuthControllerDependencies,
): AuthController {
	const setRefreshCookie = (response: Response, token: string): void => {
		response.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
			httpOnly: dependencies.cookieOptions.httpOnly,
			secure: dependencies.cookieOptions.secure,
			sameSite: dependencies.cookieOptions.sameSite,
			path: dependencies.cookieOptions.path,
			maxAge: dependencies.cookieOptions.maxAge,
		});
	};

	const clearRefreshCookie = (response: Response): void => {
		response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
			httpOnly: dependencies.cookieOptions.httpOnly,
			secure: dependencies.cookieOptions.secure,
			sameSite: dependencies.cookieOptions.sameSite,
			path: dependencies.cookieOptions.path,
		});
	};

	return {
		login: async (request, response, next) => {
			try {
				const input = parse(loginSchema, request.body);
				const tokens = await dependencies.loginWithCredentials.execute(input);

				if (tokens.refreshToken !== undefined) {
					setRefreshCookie(response, tokens.refreshToken);
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
		register: async (request, response, next) => {
			try {
				const input = parse(registerSchema, request.body);
				await dependencies.registerUser.execute(input);

				// Uniform, honest body: the use case returns the same thing for
				// a created account and a rejected sign up, so this response is
				// identical by construction and reveals neither whether the
				// email already existed nor why it was rejected.
				response.status(StatusCodes.CREATED).json({
					message: "If the address is new, we sent a verification email.",
				});
			} catch (error) {
				next(error);
			}
		},
		refresh: async (request, response, next) => {
			try {
				const refreshToken: unknown =
					request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

				// A missing cookie and a rejected refresh token are the same
				// thing to the caller — "sign in again" — so the 401 is answered
				// with one uniform message and no distinction between "no cookie"
				// and "expired".
				if (typeof refreshToken !== "string" || refreshToken.length === 0) {
					response.status(StatusCodes.UNAUTHORIZED).json({
						error: { message: REFRESH_TOKEN_REJECTED_MESSAGE },
					});
					return;
				}

				const tokens = await dependencies.refreshSession.execute({
					refreshToken,
				});

				// Rotate the cookie only when the provider issued a new refresh
				// token; a provider that does not rotate leaves the existing one.
				if (tokens.refreshToken !== undefined) {
					setRefreshCookie(response, tokens.refreshToken);
				}

				// Never forward the provider's raw payload: the response body is
				// exactly these two fields.
				response.status(StatusCodes.OK).json({
					accessToken: tokens.accessToken,
					expiresIn: tokens.expiresIn,
				});
			} catch (error) {
				if (error instanceof RefreshTokenRejectedError) {
					// The provider rejected the refresh token (expired/revoked):
					// clear the cookie so the client does not retry with a dead
					// token, and answer with the same uniform 401 as the
					// missing-cookie path. Provider 5xx/network failures are NOT
					// this error — they stay 503 via the error handler.
					clearRefreshCookie(response);
					response.status(StatusCodes.UNAUTHORIZED).json({
						error: { message: REFRESH_TOKEN_REJECTED_MESSAGE },
					});
					return;
				}

				next(error);
			}
		},
		logout: async (_request, response, next) => {
			try {
				// Deliberately NOT behind `requireAuth`: an expired access token
				// must not block signing out. No Auth0 revocation happens here —
				// revoking the issued refresh token needs the Management API,
				// which is out of scope. The cookie is cleared; the issued token
				// stays valid until it expires.
				clearRefreshCookie(response);
				response.status(StatusCodes.NO_CONTENT).send();
			} catch (error) {
				next(error);
			}
		},
	};
}
