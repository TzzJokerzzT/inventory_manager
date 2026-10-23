"use client";

import { Modal } from "@/components/design-system";
import { Button } from "@/components/ui/button";

export interface IdleSessionModalProps {
	open: boolean;
	/** The configured idle window, in minutes. */
	idleMinutes: number;
	/** Whole seconds left before the session is closed. */
	secondsRemaining: number;
	/** Keeps the session alive: restarts the window and closes the warning. */
	stayActive: () => void;
}

/**
 * The warning S2 asks for: how long the session has gone without activity, that
 * it is about to be closed, and a live countdown to the deadline.
 *
 * One action only. "Seguir conectado" and every way of dismissing the dialog are
 * the same answer, because interacting is activity: a person who presses the X,
 * the backdrop or Escape is clearly still there, so closing must never be read
 * as "let it expire". Nothing in this component can end the session — the clock
 * does that, and it does not come through this callback.
 *
 * The countdown lives in the body rather than in `description` for one reason:
 * `Modal`'s description is a plain string, so a live region has to be markup.
 * The static sentence stays in the description (it is what `aria-describedby`
 * points at) and the changing part is announced politely on its own.
 */
export function IdleSessionModal({
	open,
	idleMinutes,
	secondsRemaining,
	stayActive,
}: IdleSessionModalProps) {
	return (
		<Modal
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					stayActive();
				}
			}}
			title="¿Seguís ahí?"
			description={`Tu sesión lleva ${formatMinutes(idleMinutes)} sin actividad.`}
			footer={
				<Button type="button" size="sm" variant="primary" onClick={stayActive}>
					Seguir conectado
				</Button>
			}
		>
			<p
				aria-live="polite"
				className="text-base font-bold text-text-primary tabular-nums"
			>
				{`Se cerrará en ${formatCountdown(secondsRemaining)}.`}
			</p>
		</Modal>
	);
}

/**
 * `m:ss`, the shape a countdown is read in.
 *
 * Rounded up so the deadline never shows `0:00` while the session is still
 * alive, and floored at zero so a tick that lands after the deadline cannot
 * print a negative.
 */
function formatCountdown(seconds: number): string {
	const whole = Math.max(0, Math.ceil(seconds));
	const minutes = Math.floor(whole / 60);
	const rest = whole % 60;

	return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * Spanish label for the window: "15 minutos", "1 minuto".
 *
 * A local run may leave a decimal behind (`0,05` with the 3 s window), so the
 * comma is not a typo — it is how Spanish writes it.
 */
function formatMinutes(minutes: number): string {
	const rounded = Math.round(minutes * 100) / 100;
	const label = String(rounded).replace(".", ",");

	return `${label} ${rounded === 1 ? "minuto" : "minutos"}`;
}
