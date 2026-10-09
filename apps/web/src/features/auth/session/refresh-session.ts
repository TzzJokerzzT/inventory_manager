import { getApiClient, setOnUnauthorized } from "@/lib/api/client";
import { parseLoginResponse } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { useSessionStore } from "@/src/store/session-store/session-store";

let inflight: Promise<void> | undefined;

/**
 * Refreshes the access token from the httpOnly refresh cookie.
 *
 * Single-flight: concurrent callers (the bootstrap and any 401 interceptor)
 * share the same in-flight request, so a burst of 401s mints exactly one token.
 * On success the token lands in the session store; on failure the store is
 * cleared so a dead refresh cookie never leaves a stale token behind.
 */
export function refreshSession(): Promise<void> {
	inflight ??= performRefresh().finally(() => {
		inflight = undefined;
	});
	return inflight;
}

// Registers the single-flight refresh as the shared 401 handler at module
// load. The client resolves it lazily at request time, so a data hook that
// built the client first with only `getAccessToken` — or a bootstrap that
// short-circuits because a token is already present — still refreshes on a 401.
setOnUnauthorized(refreshSession);

async function performRefresh(): Promise<void> {
	try {
		// `skipAuthRefresh` marks this as the refresh request itself, so a 401
		// here is surfaced to the caller instead of triggering another refresh.
		const response = await getApiClient({
			getAccessToken,
			onUnauthorized: refreshSession,
		}).post("/auth/refresh", undefined, { skipAuthRefresh: true });

		// `POST /auth/refresh` answers the same `{ accessToken, expiresIn }`
		// shape as login, so the login parser is the boundary for both.
		const { accessToken } = parseLoginResponse(response.data);
		useSessionStore.getState().setSession({ accessToken });
	} catch (error) {
		useSessionStore.getState().clear();
		throw error;
	}
}
