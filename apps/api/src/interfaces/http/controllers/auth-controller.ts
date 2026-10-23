import type { RequestHandler, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { parse } from "valibot";
import type { EndSessionUseCase } from "../../../application/use-cases/end-session.js";
import type { LoginWithCredentialsUseCase } from "../../../application/use-cases/login-with-credentials.js";
import type { RefreshSessionUseCase } from "../../../application/use-cases/refresh-session.js";
import type { RegisterUserUseCase } from "../../../application/use-cases/register-user.js";
import type { ResumeSessionUseCase } from "../../../application/use-cases/resume-session.js";
import type { StartSessionUseCase } from "../../../application/use-cases/start-session.js";
import {
	REFRESH_TOKEN_REJECTED_MESSAGE,
	RefreshTokenRejectedError,
} from "../../../domain/errors/refresh-token-rejected-error.js";
import { SessionInvalidError } from "../../../domain/errors/session-invalid-error.js";
import { loginSchema, registerSchema } from "../validators/auth-validator.js";

/**
 * Name of the cookie that carries the refresh token. It is `httpOnly`, so an
 * XSS cannot read the long-lived session; the access token stays in the JSON
 * body for the SPA's `Authorization: Bearer` header.
 */
export const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

/**
 * Name of the cookie that carries the server-side session id.
 *
 * It is a second cookie on purpose. The refresh token is opaque and belongs to
 * the identity provider, so it cannot express "this session was signed out" or
 * "this browser has been idle too long"; the id points at the `sessions` row
 * that can. It is `httpOnly` for the same reason as the refresh token, and it
 * is useless on its own: only the pair can be exchanged, because
 * `POST /auth/refresh` requires both.
 */
export const SESSION_COOKIE_NAME = "session_id";

/**
 * Lifetime of the refresh-token cookie: 30 days.
 *
 * It mirrors Auth0's default refresh-token lifetime for the Resource Owner
 * Password grant. Align it with the tenant's token-lifetime settings at deploy
 * time so the cookie does not outlive the token it holds.
 *
 * This is the **browser's** cap, not the idle policy: the session row decides
 * when the cookie stops working (`SESSION_IDLE_TIMEOUT_MINUTES`), and keeping
 * the cookie alive longer is what lets a person return after a weekend without
 * having to sign in again.
 */
export const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cookie options for both session cookies. Injected from the composition root
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
	startSession: StartSessionUseCase;
	resumeSession: ResumeSessionUseCase;
	endSession: EndSessionUseCase;
	cookieOptions: AuthCookieOptions;
}

export interface AuthController {
	login: RequestHandler;
	register: RequestHandler;
	refresh: RequestHandler;
	logout: RequestHandler;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

export function createAuthController(
	dependencies: AuthControllerDependencies,
): AuthController {
	const cookieAttributes = (): AuthCookieOptions => ({
		httpOnly: dependencies.cookieOptions.httpOnly,
		secure: dependencies.cookieOptions.secure,
		sameSite: dependencies.cookieOptions.sameSite,
		path: dependencies.cookieOptions.path,
		maxAge: dependencies.cookieOptions.maxAge,
	});

	const setRefreshCookie = (response: Response, token: string): void => {
		response.cookie(REFRESH_TOKEN_COOKIE_NAME, token, cookieAttributes());
	};

	const setSessionCookie = (response: Response, sessionId: string): void => {
		response.cookie(SESSION_COOKIE_NAME, sessionId, cookieAttributes());
	};

	const clearRefreshCookie = (response: Response): void => {
		response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
			httpOnly: dependencies.cookieOptions.httpOnly,
			secure: dependencies.cookieOptions.secure,
			sameSite: dependencies.cookieOptions.sameSite,
			path: dependencies.cookieOptions.path,
		});
	};

	const clearSessionCookie = (response: Response): void => {
		response.clearCookie(SESSION_COOKIE_NAME, {
			httpOnly: dependencies.cookieOptions.httpOnly,
			secure: dependencies.cookieOptions.secure,
			sameSite: dependencies.cookieOptions.sameSite,
			path: dependencies.cookieOptions.path,
		});
	};

	/**
	 * Clears both cookies. Anything that ends a session client-side — a rejected
	 * refresh, a dead session, a sign-out — has to drop the pair, or the browser
	 * would keep sending half of it on every refresh attempt.
	 */
	const clearSessionCookies = (response: Response): void => {
		clearRefreshCookie(response);
		clearSessionCookie(response);
	};

	/**
	 * The one 401 body for every failed refresh: a missing cookie, an idle
	 * session and a provider rejection are indistinguishable to the caller.
	 */
	const respondRefreshRejected = (response: Response): void => {
		response.status(StatusCodes.UNAUTHORIZED).json({
			error: { message: REFRESH_TOKEN_REJECTED_MESSAGE },
		});
	};

	return {
		login: async (request, response, next) => {
			try {
				const input = parse(loginSchema, request.body);
				const { tokens, user } =
					await dependencies.loginWithCredentials.execute(input);

				// The session row and its cookie only make sense together with a
				// refresh token: without one there is nothing to renew, and the
				// row would be state that can never be resumed. A provider that
				// issues no refresh token therefore leaves the legacy behaviour
				// untouched.
				if (tokens.refreshToken !== undefined) {
					const session = await dependencies.startSession.execute({
						userId: user.id,
						refreshToken: tokens.refreshToken,
					});
					setRefreshCookie(response, tokens.refreshToken);
					setSessionCookie(response, session.id);
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
				const sessionId: unknown = request.cookies?.[SESSION_COOKIE_NAME];

				// A missing cookie and a rejected refresh token are the same
				// thing to the caller — "sign in again" — so the 401 is answered
				// with one uniform message and no distinction between "no cookie"
				// and "expired". A session cookie without its refresh token (or
				// the other way around) is exactly as unusable as neither.
				if (!isNonEmptyString(refreshToken) || !isNonEmptyString(sessionId)) {
					respondRefreshRejected(response);
					return;
				}

				try {
					// The session gate runs BEFORE the exchange on purpose. With
					// refresh-token rotation enabled, exchanging produces a new
					// token and invalidates the old one, so spending the token
					// first and rejecting the session afterwards would destroy a
					// working session just to answer 401.
					//
					// It also checks that the token belongs to this session: a
					// live row is not enough, or a stolen refresh token could be
					// exchanged next to any other live session id.
					await dependencies.resumeSession.execute({
						sessionId,
						refreshToken,
					});
				} catch (error) {
					if (error instanceof SessionInvalidError) {
						// Unknown, revoked or idle past the window: the cookie is
						// dead, so drop the pair instead of letting the client
						// retry with it.
						clearSessionCookies(response);
						respondRefreshRejected(response);
						return;
					}
					throw error;
				}

				const tokens = await dependencies.refreshSession.execute({
					refreshToken,
				});

				// Only a completed exchange counts as activity, and the row now
				// expects the token the provider just handed back — the rotated
				// one when there is one, otherwise the one that was presented.
				await dependencies.resumeSession.recordRefresh({
					sessionId,
					refreshToken: tokens.refreshToken ?? refreshToken,
				});

				// Rotate the cookie only when the provider issued a new refresh
				// token; a provider that does not rotate leaves the existing one.
				if (tokens.refreshToken !== undefined) {
					setRefreshCookie(response, tokens.refreshToken);
				}

				// The session cookie slides with the refresh: both are transport
				// for the same live session, and letting one expire while the other
				// rotates would log out an active person for no policy reason. The
				// row, not this maxAge, is what decides the idle window.
				setSessionCookie(response, sessionId);

				// Never forward the provider's raw payload: the response body is
				// exactly these two fields.
				response.status(StatusCodes.OK).json({
					accessToken: tokens.accessToken,
					expiresIn: tokens.expiresIn,
				});
			} catch (error) {
				if (error instanceof RefreshTokenRejectedError) {
					// The provider rejected the refresh token (expired/revoked):
					// clear the pair so the client does not retry with a dead
					// token, and answer with the same uniform 401 as the
					// missing-cookie path. Provider 5xx/network failures are NOT
					// this error — they stay 503 via the error handler.
					clearSessionCookies(response);
					respondRefreshRejected(response);
					return;
				}

				next(error);
			}
		},
		logout: async (request, response, next) => {
			try {
				// Deliberately NOT behind `requireAuth`: an expired access token
				// must not block signing out. Revoking the session row is what
				// makes the credential unusable: replaying the same cookies
				// against `/auth/refresh` answers 401 afterwards. No Auth0
				// revocation happens here — revoking the issued refresh token
				// needs the Management API, which is out of scope; what is
				// revoked is our only path to exchange it.
				const sessionId: unknown = request.cookies?.[SESSION_COOKIE_NAME];
				if (isNonEmptyString(sessionId)) {
					await dependencies.endSession.execute({ sessionId });
				}

				clearSessionCookies(response);
				response.status(StatusCodes.NO_CONTENT).send();
			} catch (error) {
				next(error);
			}
		},
	};
}
