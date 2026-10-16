"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/src/store/session-store/session-store";
import { refreshSession } from "./refresh-session";

/**
 * Restores the session on mount.
 *
 * With no access token in memory, it asks the API to mint one from the
 * httpOnly refresh cookie, then marks the resolution as finished (success or
 * failure) so guards stop waiting and decide. With a token already present
 * there is nothing to restore and the resolution is marked immediately.
 */
export function useSessionBootstrap() {
	const accessToken = useSessionStore((state) => state.accessToken);
	const resolved = useSessionStore((state) => state.resolved);
	const markResolved = useSessionStore((state) => state.markResolved);

	useEffect(() => {
		if (resolved) {
			return;
		}
		if (accessToken) {
			markResolved();
			return;
		}
		refreshSession()
			.catch(() => undefined)
			.finally(markResolved);
	}, [accessToken, resolved, markResolved]);
}
