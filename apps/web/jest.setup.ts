/**
 * Gaps in jsdom that this suite has to fill.
 *
 * jsdom implements neither `Element.prototype.scrollTo` nor smooth scrolling.
 * `AppShell` calls `scrollTo` on every route change to reset its scroll
 * container, so without this stub every render of the shell throws instead of
 * exercising the component.
 */
Element.prototype.scrollTo = () => {};
