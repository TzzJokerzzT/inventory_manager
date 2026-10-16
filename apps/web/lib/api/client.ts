import axios, { type AxiosInstance } from "axios";

declare module "axios" {
	interface AxiosRequestConfig {
		/** Set by the 401 interceptor after a retry, so a request retries at most once. */
		_retried?: boolean;
		/** Set on the refresh request itself, so its 401 is never retried. */
		skipAuthRefresh?: boolean;
	}
}

/**
 * Single error type the UI has to know about.
 *
 * Callers never inspect an Axios error to find a message: the interceptor in
 * {@link createApiClient} turns every failure into one of these, carrying the
 * status when there was a response at all.
 */
export class ApiError extends Error {
	readonly status?: number;
	readonly code?: string;

	constructor(message: string, status?: number, code?: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
	}
}

/** Shown when the API answered, but without a message we can surface. */
const FALLBACK_MESSAGE = "No pudimos completar la operación.";

/** Shown when the request never reached the API. */
const NETWORK_MESSAGE = "No pudimos contactar al servidor.";

/**
 * Reads the API's error shape: `{ error: { message } }`.
 *
 * Anything else is treated as "no message", so a proxy answering HTML with a
 * 502 never leaks markup into the UI.
 */
function readApiMessage(data: unknown): string | undefined {
	if (typeof data !== "object" || data === null) {
		return undefined;
	}

	const error = (data as { error?: unknown }).error;
	if (typeof error !== "object" || error === null) {
		return undefined;
	}

	const message = (error as { message?: unknown }).message;
	return typeof message === "string" && message.trim() !== ""
		? message
		: undefined;
}

/**
 * Reads the API's machine-readable error code: `{ error: { code } }`.
 *
 * It is optional (most errors only carry a message), so anything else is
 * treated as "no code".
 */
function readApiCode(data: unknown): string | undefined {
	if (typeof data !== "object" || data === null) {
		return undefined;
	}

	const error = (data as { error?: unknown }).error;
	if (typeof error !== "object" || error === null) {
		return undefined;
	}

	const code = (error as { code?: unknown }).code;
	return typeof code === "string" && code.trim() !== "" ? code : undefined;
}

function toApiError(error: unknown): unknown {
	const code = axios.isAxiosError(error) ? error.code : undefined;
	if (axios.isCancel(error) || code === "ERR_CANCELED") {
		// A canceled request is not a failure to show: the caller asked for it.
		return error;
	}

	if (!axios.isAxiosError(error)) {
		return error;
	}

	const status = error.response?.status;
	if (status === undefined) {
		return new ApiError(NETWORK_MESSAGE);
	}

	return new ApiError(
		readApiMessage(error.response?.data) ?? FALLBACK_MESSAGE,
		status,
		readApiCode(error.response?.data),
	);
}

/**
 * Builds the HTTP client.
 *
 * It is a factory so tests can inject a base URL and an adapter without
 * touching the environment; {@link getApiClient} wraps it for app code.
 *
 * `withCredentials` is on because the refresh token is an `httpOnly` cookie
 * that the API sets from a different origin: without it the browser would
 * neither store nor send it.
 *
 * The `getAccessToken` callback keeps this module generic: it cannot import a
 * feature, so the auth feature hands over a provider that reads the token from
 * its session store. When the provider returns a token it is attached as
 * `Authorization: Bearer`; when it returns none the header is simply omitted.
 *
 * `onUnauthorized` is the same injection pattern for the 401 flow: the auth
 * feature hands over a single-flight refresh that stores a fresh token, and the
 * client retries the original request once when it resolves. The client itself
 * never imports the feature.
 */
export interface ApiClientOptions {
	getAccessToken?: () => string | undefined;
	onUnauthorized?: () => Promise<void>;
}

/**
 * The shared 401 handler, registered once by the auth feature.
 *
 * It is read lazily on every 401 — the same way the access token is read on
 * every request — so the handler a request sees is the one registered now, not
 * whichever handler (or none) happened to sit in the options of the first
 * `getApiClient` call. No caller order, mount order or short-circuited
 * bootstrap can leave the shared client without a refresh handler.
 */
let sharedOnUnauthorized: (() => Promise<void>) | undefined;

/**
 * Registers the single-flight refresh the 401 interceptor runs.
 *
 * The auth feature owns the function and calls this once at module load. The
 * client stays generic: it only ever stores a `() => Promise<void>`, never a
 * feature import.
 */
export function setOnUnauthorized(
	handler: (() => Promise<void>) | undefined,
): void {
	sharedOnUnauthorized = handler;
}

export function createApiClient(
	baseURL?: string,
	options: ApiClientOptions = {},
): AxiosInstance {
	const resolved = baseURL ?? process.env.NEXT_PUBLIC_API_URL;
	if (!resolved) {
		// Fail fast: a silent localhost fallback would point at nothing once
		// the app is deployed.
		throw new Error(
			"Missing NEXT_PUBLIC_API_URL: copy apps/web/.env.example to .env.local and set the API base URL",
		);
	}

	const client = axios.create({
		baseURL: resolved,
		withCredentials: true,
	});

	client.interceptors.request.use((config) => {
		const token = options.getAccessToken?.();
		if (token) {
			config.headers.set("Authorization", `Bearer ${token}`);
		}
		return config;
	});

	client.interceptors.response.use(
		(response) => response,
		async (error: unknown) => {
			const apiError = toApiError(error);
			// Resolved at request time, like the token above: a client built
			// before the auth feature registered the handler (or by a caller
			// that only passed `getAccessToken`) still refreshes on a 401.
			const onUnauthorized = options.onUnauthorized ?? sharedOnUnauthorized;

			if (
				apiError instanceof ApiError &&
				apiError.status === 401 &&
				onUnauthorized &&
				axios.isAxiosError(error) &&
				error.config &&
				!error.config._retried &&
				!error.config.skipAuthRefresh
			) {
				try {
					await onUnauthorized();
				} catch (refreshError) {
					// A failed refresh leaves the session cleared (the feature owns
					// that); surface it as the caller-facing failure.
					throw toApiError(refreshError);
				}

				const config = error.config;
				config._retried = true;
				return client.request(config);
			}

			throw apiError;
		},
	);

	return client;
}

let cached: AxiosInstance | undefined;

/**
 * The client used by the app. Built lazily so importing this module never
 * requires the environment to be configured (tests import the factory).
 *
 * Both auth hooks are resolved at request time, never baked into whichever
 * caller happened to build the client first:
 * - the access token is read through the provider on every request, so a
 *   token set after the client was built is still attached;
 * - the 401 handler is read from {@link setOnUnauthorized} on every 401, so a
 *   client built by a caller that only passes `getAccessToken` — or built
 *   before the bootstrap ever ran — still refreshes.
 *
 * `cached ??=` therefore fixes only the transport, not the auth wiring. No
 * caller order, mount order or missing bootstrap call can silently disable
 * the refresh.
 */
export function getApiClient(options?: ApiClientOptions): AxiosInstance {
	cached ??= createApiClient(undefined, options);
	return cached;
}
