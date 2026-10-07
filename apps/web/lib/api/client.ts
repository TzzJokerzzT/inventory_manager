import axios, { type AxiosInstance } from "axios";

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
 */
export interface ApiClientOptions {
	getAccessToken?: () => string | undefined;
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
		(error: unknown) => {
			throw toApiError(error);
		},
	);

	return client;
}

let cached: AxiosInstance | undefined;

/**
 * The client used by the app. Built lazily so importing this module never
 * requires the environment to be configured (tests import the factory).
 *
 * The access-token provider is wired by the auth feature and read lazily on
 * every request, so a token set after the client was built is still attached.
 *
 * The first caller fixes the options for the lifetime of the process: the
 * `cached ??=` below captures `options` only once. That is why every feature
 * hook that can be the first to touch the client (`useLogin`, `useRegister`,
 * `useCompanies`) passes the same access-token provider. Leaving the provider
 * to whichever hook happens to run first would make `Authorization` depend on
 * import order — the kind of bug that shows up as a 401 nobody can reproduce
 * locally.
 */
export function getApiClient(options?: ApiClientOptions): AxiosInstance {
	cached ??= createApiClient(undefined, options);
	return cached;
}
