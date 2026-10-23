"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLogout } from "@/src/features/auth/logout/use-logout";
import { useSessionStore } from "@/src/store/session-store/session-store";

/** Idle window used when `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES` is unset. */
export const DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES = 15;

/**
 * How long before the deadline the warning opens: two minutes, per S2.
 *
 * With the default window the modal appears at minute 13 and counts down the
 * last 120 seconds. A local window shorter than the lead simply warns from the
 * first tick, which is exactly what the arithmetic says.
 */
export const SESSION_IDLE_WARNING_LEAD_MS = 2 * 60 * 1000;

/** Resolution of the monitor. One tick per second is what the countdown shows. */
const SESSION_IDLE_TICK_MS = 1000;

/**
 * Reads the configured idle window, in minutes.
 *
 * The value is a number of minutes and positive decimals are on purpose: a
 * local run sets `0.05` (3 s) to watch a whole idle cycle without waiting a
 * quarter of an hour. Anything that is not a positive finite number — unset,
 * empty, `0`, a negative, a typo — falls back to the default, because an
 * unreadable variable must never be the reason the idle logout stops working.
 */
export function parseIdleTimeoutMinutes(raw: string | undefined): number {
	if (raw === undefined || raw.trim() === "") {
		return DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES;
	}

	const minutes = Number(raw);
	if (!Number.isFinite(minutes) || minutes <= 0) {
		return DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES;
	}

	return minutes;
}

/**
 * The window, resolved once at module load.
 *
 * `NEXT_PUBLIC_*` variables are inlined by the Next.js build, so the browser
 * bundle has to bake the value in there anyway; re-reading it per render or per
 * tick would only add noise.
 */
export const SESSION_IDLE_TIMEOUT_MINUTES = parseIdleTimeoutMinutes(
	process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES,
);

const IDLE_WINDOW_MS = SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;

export interface IdleSession {
	/** True while the warning modal should be on screen. */
	warningOpen: boolean;
	/** The configured idle window, in minutes. */
	idleMinutes: number;
	/** Whole seconds left before the session is closed. */
	secondsRemaining: number;
	/** Keeps the session alive: restarts the window and closes the warning. */
	stayActive: () => void;
}

/**
 * Closes the session after a window without interaction.
 *
 * Two timers live here on purpose, and they answer different questions:
 * - a `setInterval` of one second is the monitor. While less than
 *   `SESSION_IDLE_WARNING_LEAD_MS` is left it is silent; inside the lead it
 *   publishes the remaining seconds; at the deadline it logs out;
 * - the activity listeners (`pointerdown`, `keydown`, `wheel`, `touchstart`,
 *   plus the tab becoming visible) only move the anchor, which is the single
 *   piece of state the monitor reads.
 *
 * The anchor lives in a ref, not in state: a mouseless scroll or a keystroke
 * must not re-render the tree, and the interval must not be torn down and
 * rebuilt on every interaction. Everything the monitor needs is read through
 * refs so the interval is created once per live session.
 *
 * Logout goes through `useLogout()`, never through the API client directly:
 * that hook owns `POST /auth/logout`, clearing the store and landing on
 * `/login`, and this monitor only decides *when*.
 */
export function useIdleSession(): IdleSession {
	const accessToken = useSessionStore((state) => state.accessToken);
	const sessionLive = accessToken !== undefined;
	const logout = useLogout();

	const lastActivityRef = useRef(Date.now());
	const loggedOutRef = useRef(false);
	const [warningOpen, setWarningOpen] = useState(false);
	const [secondsRemaining, setSecondsRemaining] = useState(0);

	// `useLogout` hands back a new closure on every render, while the interval
	// below must survive re-renders (it fires the countdown updates). The ref
	// keeps the interval reading the current one without listing it as a
	// dependency.
	const logoutRef = useRef(logout);
	useEffect(() => {
		logoutRef.current = logout;
	}, [logout]);

	/**
	 * Milliseconds left before the deadline. Negative once it passed.
	 *
	 * It is a callback over refs, not state: the interval, the listeners and the
	 * answer to the warning all need to judge the same anchor without re-rendering.
	 */
	const remainingMs = useCallback(
		() => IDLE_WINDOW_MS - (Date.now() - lastActivityRef.current),
		[],
	);

	/**
	 * Closes the session when the window already elapsed, and reports whether it
	 * did.
	 *
	 * This is the one path that ends a session, and the guard is what makes it
	 * fire exactly once: later calls are no-ops even before React tears the
	 * interval down, so a logout already on its way is never sent twice.
	 */
	const expireIfDue = useCallback((): boolean => {
		if (remainingMs() > 0) {
			return false;
		}

		if (loggedOutRef.current) {
			return true;
		}

		loggedOutRef.current = true;
		setWarningOpen(false);
		void logoutRef.current();

		return true;
	}, [remainingMs]);

	/**
	 * The answer to the warning, and also the answer to any interaction.
	 *
	 * S2 says dismissing the modal counts as activity *because interacting is
	 * activity*, so one function serves the button, the close control, the
	 * backdrop and every listener: restart the anchor, drop the warning.
	 *
	 * It checks the deadline first. A hidden tab has its timers throttled by the
	 * browser, so the tick that should have logged out may not have run yet; in
	 * that case this interaction is the first thing to notice the window is gone,
	 * and extending the session here would silently defeat S1 for exactly the
	 * case it exists for (the tab left open overnight).
	 */
	const stayActive = useCallback(() => {
		if (expireIfDue()) {
			return;
		}

		lastActivityRef.current = Date.now();
		setWarningOpen(false);
	}, [expireIfDue]);

	// A session that just went live — a login, or a bootstrap that restored the
	// token — starts the window now and re-arms the logout guard. A session that
	// ended cannot be warned about, so the modal is closed here as well: a logout
	// from another tab or a dead refresh cookie never leaves it on screen.
	useEffect(() => {
		if (!sessionLive) {
			setWarningOpen(false);
			return;
		}
		lastActivityRef.current = Date.now();
		loggedOutRef.current = false;
	}, [sessionLive]);

	useEffect(() => {
		if (!sessionLive) {
			return;
		}

		// `passive: true`: these listeners only read the clock, so the browser is
		// allowed to keep scrolling and pinch-zooming on the main thread. They are
		// registered once per live session — `stayActive` is stable.
		const options = { passive: true } as const;
		window.addEventListener("pointerdown", stayActive, options);
		window.addEventListener("keydown", stayActive, options);
		window.addEventListener("wheel", stayActive, options);
		window.addEventListener("touchstart", stayActive, options);

		// S1 anchors the window on the moment the tab becomes visible again. Time
		// spent hidden still counts — the interval below never pauses — so a tab
		// hidden past the deadline ends the session before it is ever shown again;
		// this only gives a tab that comes back in time a fresh window.
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				stayActive();
			}
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("pointerdown", stayActive);
			window.removeEventListener("keydown", stayActive);
			window.removeEventListener("wheel", stayActive);
			window.removeEventListener("touchstart", stayActive);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [sessionLive, stayActive]);

	useEffect(() => {
		if (!sessionLive) {
			return;
		}

		const interval = setInterval(() => {
			if (expireIfDue()) {
				return;
			}

			const remaining = remainingMs();

			// Rounded up so the last second reads `0:01` while the session is still
			// alive, and no-op updates are skipped to keep re-renders to one per
			// second.
			setSecondsRemaining((previous) => {
				const next = Math.ceil(remaining / SESSION_IDLE_TICK_MS);
				return previous === next ? previous : next;
			});

			if (remaining <= SESSION_IDLE_WARNING_LEAD_MS) {
				setWarningOpen(true);
			}
		}, SESSION_IDLE_TICK_MS);

		return () => clearInterval(interval);
	}, [sessionLive, expireIfDue, remainingMs]);

	return {
		warningOpen,
		idleMinutes: SESSION_IDLE_TIMEOUT_MINUTES,
		secondsRemaining,
		stayActive,
	};
}
