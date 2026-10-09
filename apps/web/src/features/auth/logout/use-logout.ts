"use client";

import { useRouter } from "next/navigation";
import { getApiClient } from "@/lib/api/client";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { refreshSession } from "@/src/features/auth/session/refresh-session";
import { useSessionStore } from "@/src/store/session-store/session-store";

/**
 * Logs the user out: clears the httpOnly refresh cookie server-side, drops the
 * in-memory access token and lands on `/login`.
 *
 * The visual control belongs to MI-20; this is the hook and its wiring. The
 * store is cleared in `finally` so a failed logout request never leaves the
 * user "logged in" — a stale local session is worse than a failed call.
 *
 * The request marks itself with `skipAuthRefresh` so a 401 from logout never
 * triggers the refresh interceptor: signing out is an auth flow, not a data
 * request whose expired token should be renewed.
 */
export function useLogout() {
	const router = useRouter();
	const clear = useSessionStore((state) => state.clear);

	return async () => {
		try {
			await getApiClient({
				getAccessToken,
				onUnauthorized: refreshSession,
			}).post("/auth/logout", undefined, { skipAuthRefresh: true });
		} catch {
			// The cookie may already be gone or the API unreachable; clearing
			// locally and redirecting is the honest outcome either way.
		} finally {
			clear();
			router.replace("/login");
		}
	};
}
