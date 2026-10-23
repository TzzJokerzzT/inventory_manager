"use client";

import { IdleSessionModal } from "./components/idle-session-modal";
import { useIdleSession } from "./use-idle-session";

/**
 * Mounts the idle monitor and its warning.
 *
 * It belongs in the provider tree, next to `SessionBootstrap`: the monitor is a
 * window-level effect that must exist exactly once, above every route, and no
 * page should be able to mount a second copy (two monitors would race to log
 * out). It renders only the warning modal, which portals out when it opens and
 * renders nothing while the session is idle-free.
 */
export function IdleSessionGuard() {
	const { warningOpen, idleMinutes, secondsRemaining, stayActive } =
		useIdleSession();

	return (
		<IdleSessionModal
			open={warningOpen}
			idleMinutes={idleMinutes}
			secondsRemaining={secondsRemaining}
			stayActive={stayActive}
		/>
	);
}
