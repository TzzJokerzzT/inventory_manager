"use client";

import { useSessionBootstrap } from "./use-session-bootstrap";

/**
 * Mounts the session bootstrap in the provider tree, before any route content.
 *
 * It runs the refresh before guards decide, so a clean reload restores the
 * session instead of bouncing to `/login`. The refresh handler itself is
 * registered at module load (`refresh-session.ts`), so this component's mount
 * order no longer decides whether the 401 refresh is wired.
 */
export function SessionBootstrap() {
	useSessionBootstrap();
	return null;
}
