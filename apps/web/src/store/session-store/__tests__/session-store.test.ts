import { useSessionStore } from "../session-store";

describe("session store", () => {
	beforeEach(() => {
		useSessionStore.getState().clear();
	});

	it("starts without a token", () => {
		expect(useSessionStore.getState().accessToken).toBeUndefined();
	});

	it("keeps the access token in memory", () => {
		useSessionStore.getState().setSession({ accessToken: "token-value" });

		expect(useSessionStore.getState().accessToken).toBe("token-value");
	});

	it("clears the session", () => {
		useSessionStore.getState().setSession({ accessToken: "token-value" });

		useSessionStore.getState().clear();

		expect(useSessionStore.getState().accessToken).toBeUndefined();
	});

	it("never writes the token to persistent browser storage", () => {
		useSessionStore.getState().setSession({ accessToken: "token-value" });

		expect(window.localStorage.length).toBe(0);
		expect(window.sessionStorage.length).toBe(0);
	});
});
