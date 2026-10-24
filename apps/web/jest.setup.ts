/**
 * Gaps in jsdom that this suite has to fill.
 *
 * jsdom implements neither `Element.prototype.scrollTo` nor smooth scrolling.
 * `AppShell` calls `scrollTo` on every route change to reset its scroll
 * container, so without this stub every render of the shell throws instead of
 * exercising the component.
 */
Element.prototype.scrollTo = () => {};

/**
 * Tests must not inherit the developer's environment for the session window.
 *
 * `next/jest` loads `.env`, so a local `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES`
 * set for manual testing (say 0.05 minutes) would change the simulated clock:
 * the idle suite computes its thresholds from that number and ends up asking
 * Jest to advance a negative amount of time. Pinning the documented default
 * keeps every run reproducible, whatever the machine has configured.
 */
process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES = "15";
