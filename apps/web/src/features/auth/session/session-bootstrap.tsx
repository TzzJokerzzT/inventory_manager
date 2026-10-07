"use client";

import { useSessionBootstrap } from "./use-session-bootstrap";

/**
 * Mounts the session bootstrap in the provider tree, before any route content.
 *
 * Placed first so its effect runs before data-fetching hooks mount: that is
 * what lets the shared client be built with the refresh handler on its first
 * use, instead of leaving it to whichever hook happens to fire first.
 */
export function SessionBootstrap() {
	useSessionBootstrap();
	return null;
}
