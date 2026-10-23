import { act, renderHook } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { getApiClient } from "@/lib/api/client";
import { useSessionStore } from "@/src/store/session-store/session-store";
import {
	parseIdleTimeoutMinutes,
	SESSION_IDLE_TIMEOUT_MINUTES,
	SESSION_IDLE_WARNING_LEAD_MS,
	useIdleSession,
} from "../use-idle-session";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

// Only the transport is faked. `getApiClient` is the single door to the API, so
// asserting on `post` proves the hook reaches `/auth/logout` through `useLogout`
// (which marks the request `skipAuthRefresh`) and never through the client
// directly.
jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

/*
 * No test in this file sets `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES`, so the
 * window the module resolved on import is the 15 minute default. Timings are
 * still derived from it instead of hardcoded, so the suite follows the constant
 * if the default ever moves.
 */
const IDLE_WINDOW_MS = SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;
const WARNING_THRESHOLD_MS = IDLE_WINDOW_MS - SESSION_IDLE_WARNING_LEAD_MS;

/**
 * A minute per tick: the window is still fifteen simulated minutes, but the
 * monitor walks it in thirteen steps instead of nine hundred.
 */
const TEST_TICK_MS = 60_000;

const replace = jest.fn();
const post = jest.fn(async () => ({ data: undefined }));

function liveSession() {
	useSessionStore.setState({ accessToken: "token-value", resolved: true });
}

/**
 * Advances the fake clock and flushes whatever the tick started.
 *
 * The walk is synchronous on purpose. `advanceTimersByTimeAsync` awaits a
 * microtask per timer, and a window of this size is hundreds of one-second
 * ticks, so the test spent seconds of wall clock in bookkeeping and timed out
 * on a loaded machine. Advancing synchronously lets React batch the updates,
 * and the extra `act` flushes the promise the logout starts.
 */
async function advance(ms: number) {
	await act(async () => {
		jest.advanceTimersByTime(ms);
	});
	await act(async () => {
		await Promise.resolve();
	});
}

describe("useIdleSession", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		useSessionStore.setState({ accessToken: undefined, resolved: false });
		window.localStorage.clear();
		useRouterMock.mockReturnValue({
			replace,
			push: jest.fn(),
			refresh: jest.fn(),
			back: jest.fn(),
			forward: jest.fn(),
			prefetch: jest.fn(),
		} as unknown as ReturnType<typeof useRouter>);
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);
	});

	afterEach(() => {
		// One test hides the tab on purpose; leave the document as it was found.
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "visible",
		});
		jest.useRealTimers();
	});

	it("stays quiet below the warning threshold", async () => {
		liveSession();

		const { result } = renderHook(() =>
			useIdleSession({ tickMs: TEST_TICK_MS }),
		);

		await advance(WARNING_THRESHOLD_MS - 1000);

		expect(result.current.warningOpen).toBe(false);
		expect(post).not.toHaveBeenCalled();
	});

	it("opens the warning at the threshold with the seconds it has left", async () => {
		liveSession();

		const { result } = renderHook(() =>
			useIdleSession({ tickMs: TEST_TICK_MS }),
		);

		await advance(WARNING_THRESHOLD_MS);

		expect(result.current.warningOpen).toBe(true);
		expect(result.current.secondsRemaining).toBe(
			SESSION_IDLE_WARNING_LEAD_MS / 1000,
		);
		// S2 asks for how long the session *has been* idle, not for the window:
		// at the threshold that is the window minus the warning lead.
		expect(result.current.idleMinutes).toBe(
			Math.floor(WARNING_THRESHOLD_MS / 60_000),
		);
		expect(post).not.toHaveBeenCalled();
	});

	it("closes the warning and restarts the clock when the user stays active", async () => {
		liveSession();

		const { result } = renderHook(() =>
			useIdleSession({ tickMs: TEST_TICK_MS }),
		);

		await advance(WARNING_THRESHOLD_MS);
		expect(result.current.warningOpen).toBe(true);

		act(() => {
			result.current.stayActive();
		});

		expect(result.current.warningOpen).toBe(false);

		await advance(WARNING_THRESHOLD_MS - 1000);
		expect(result.current.warningOpen).toBe(false);
		expect(post).not.toHaveBeenCalled();

		// A full window after the acknowledgement the warning comes back, and the
		// session is still alive: staying active answered the countdown.
		await advance(1000);
		expect(result.current.warningOpen).toBe(true);
		expect(post).not.toHaveBeenCalled();
	});

	it.each(["pointerdown", "keydown", "wheel", "touchstart"] as const)(
		"counts %s as activity and restarts the clock instead of logging out",
		async (eventName) => {
			liveSession();

			const { result } = renderHook(() =>
				useIdleSession({ tickMs: TEST_TICK_MS }),
			);

			await advance(WARNING_THRESHOLD_MS);
			expect(result.current.warningOpen).toBe(true);

			act(() => {
				window.dispatchEvent(new Event(eventName));
			});

			expect(result.current.warningOpen).toBe(false);
			expect(result.current.secondsRemaining).toBeGreaterThan(0);

			await advance(WARNING_THRESHOLD_MS - 1000);

			expect(result.current.warningOpen).toBe(false);
			expect(post).not.toHaveBeenCalled();
		},
	);

	it("counts the tab becoming visible again as activity", async () => {
		liveSession();

		const { result } = renderHook(() =>
			useIdleSession({ tickMs: TEST_TICK_MS }),
		);

		await advance(WARNING_THRESHOLD_MS);
		expect(result.current.warningOpen).toBe(true);

		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});

		expect(result.current.warningOpen).toBe(false);

		await advance(WARNING_THRESHOLD_MS - 1000);
		expect(post).not.toHaveBeenCalled();
	});

	it("keeps counting while the tab is hidden, so hidden time is idle time", async () => {
		liveSession();
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "hidden",
		});

		const { result } = renderHook(() =>
			useIdleSession({ tickMs: TEST_TICK_MS }),
		);

		await advance(IDLE_WINDOW_MS);

		expect(result.current.warningOpen).toBe(false);
		expect(post).toHaveBeenCalledTimes(1);
		expect(useSessionStore.getState().accessToken).toBeUndefined();
	});

	it("logs out exactly once when the window elapses and then keeps quiet", async () => {
		liveSession();

		renderHook(() => useIdleSession({ tickMs: TEST_TICK_MS }));

		await advance(IDLE_WINDOW_MS);

		// One logout, through `useLogout`: the shared client call plus the
		// redirect `/login` that only that hook performs.
		expect(post).toHaveBeenCalledTimes(1);
		expect(post).toHaveBeenCalledWith("/auth/logout", undefined, {
			skipAuthRefresh: true,
		});
		expect(replace).toHaveBeenCalledWith("/login");
		expect(useSessionStore.getState().accessToken).toBeUndefined();

		await advance(10 * 60 * 1000);

		expect(post).toHaveBeenCalledTimes(1);
		expect(replace).toHaveBeenCalledTimes(1);
	});

	it("does not log out while another tab is active", async () => {
		// Every tab shares one server-side session, so an idle background tab
		// must not revoke it while the person works in another one. The shared
		// timestamp is what the monitor reads before deciding to log out.
		liveSession();

		const { result } = renderHook(() =>
			useIdleSession({ tickMs: TEST_TICK_MS }),
		);

		await advance(WARNING_THRESHOLD_MS);
		expect(result.current.warningOpen).toBe(true);

		// The other tab just interacted: it wins over this tab's anchor.
		act(() => {
			window.localStorage.setItem(
				"inventory-manager:session-activity-at",
				String(Date.now()),
			);
		});
		await advance(TEST_TICK_MS);

		expect(post).not.toHaveBeenCalled();
		expect(result.current.warningOpen).toBe(false);
		// The clock restarted from the other tab's timestamp, so at most the single
		// tick that just elapsed has been counted.
		expect(result.current.idleMinutes).toBeLessThanOrEqual(1);
	});

	it("logs out instead of extending when timers were throttled past the deadline", async () => {
		// A hidden or suspended tab has its timers throttled by the browser, so
		// the tick that should have logged out may never run. Returning to the tab
		// dispatches an interaction: it must notice the closed window instead of
		// restarting it, or leaving the app open overnight would never sign out.
		liveSession();

		const { result } = renderHook(() =>
			useIdleSession({ tickMs: TEST_TICK_MS }),
		);

		act(() => {
			jest.setSystemTime(Date.now() + IDLE_WINDOW_MS);
		});

		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"));
		});

		expect(post).toHaveBeenCalledTimes(1);
		expect(replace).toHaveBeenCalledWith("/login");
		expect(result.current.warningOpen).toBe(false);
	});

	it("logs out instead of extending when an interaction arrives past the deadline", async () => {
		liveSession();

		const { result } = renderHook(() =>
			useIdleSession({ tickMs: TEST_TICK_MS }),
		);

		act(() => {
			jest.setSystemTime(Date.now() + IDLE_WINDOW_MS);
		});

		await act(async () => {
			window.dispatchEvent(new Event("pointerdown"));
		});

		expect(post).toHaveBeenCalledTimes(1);
		expect(result.current.warningOpen).toBe(false);
	});

	it("never schedules a timer or logs out without an access token", async () => {
		const { result } = renderHook(() =>
			useIdleSession({ tickMs: TEST_TICK_MS }),
		);

		expect(jest.getTimerCount()).toBe(0);

		await advance(2 * IDLE_WINDOW_MS);

		expect(result.current.warningOpen).toBe(false);
		expect(post).not.toHaveBeenCalled();
		expect(replace).not.toHaveBeenCalled();
	});

	it("drops its timers and listeners on unmount", async () => {
		liveSession();

		const clearIntervalSpy = jest.spyOn(global, "clearInterval");
		const { unmount } = renderHook(() =>
			useIdleSession({ tickMs: TEST_TICK_MS }),
		);

		await advance(WARNING_THRESHOLD_MS);
		unmount();

		// `getTimerCount` would also see React's own scheduled work, so the
		// teardown is asserted on the monitor's interval plus the behaviour that
		// matters: nothing fires once it is unmounted.
		expect(clearIntervalSpy).toHaveBeenCalled();

		act(() => {
			window.dispatchEvent(new Event("pointerdown"));
		});
		await advance(IDLE_WINDOW_MS);

		expect(post).not.toHaveBeenCalled();
	});

	it("stops warning and counting when the session ends elsewhere", async () => {
		liveSession();

		const { result } = renderHook(() =>
			useIdleSession({ tickMs: TEST_TICK_MS }),
		);

		await advance(WARNING_THRESHOLD_MS);
		expect(result.current.warningOpen).toBe(true);

		act(() => {
			useSessionStore.getState().clear();
		});

		expect(result.current.warningOpen).toBe(false);

		await advance(IDLE_WINDOW_MS);

		expect(post).not.toHaveBeenCalled();
	});
});

describe("parseIdleTimeoutMinutes", () => {
	it("falls back to the 15 minute default when the variable is unset", () => {
		expect(parseIdleTimeoutMinutes(undefined)).toBe(15);
		expect(parseIdleTimeoutMinutes("")).toBe(15);
		expect(parseIdleTimeoutMinutes("   ")).toBe(15);
	});

	it("accepts the positive decimals a local run needs", () => {
		expect(parseIdleTimeoutMinutes("0.05")).toBe(0.05);
		expect(parseIdleTimeoutMinutes("0.5")).toBe(0.5);
		expect(parseIdleTimeoutMinutes("30")).toBe(30);
	});

	it("falls back to the default for zero, negatives and non-numbers", () => {
		expect(parseIdleTimeoutMinutes("0")).toBe(15);
		expect(parseIdleTimeoutMinutes("-5")).toBe(15);
		expect(parseIdleTimeoutMinutes("quince")).toBe(15);
		expect(parseIdleTimeoutMinutes("Infinity")).toBe(15);
	});
});

describe("SESSION_IDLE_TIMEOUT_MINUTES", () => {
	it("resolves NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES from the environment", async () => {
		const original = process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES;
		process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES = "0.05";
		jest.resetModules();

		try {
			const reloaded = await import("../use-idle-session");

			expect(reloaded.SESSION_IDLE_TIMEOUT_MINUTES).toBe(0.05);
		} finally {
			if (original === undefined) {
				delete process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES;
			} else {
				process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES = original;
			}
			jest.resetModules();
		}
	});
});
