import { createApiClient } from "@/lib/api/client";
import { useSessionStore } from "../../store/session-store";
import { getAccessToken } from "../get-access-token";

function clientWithTokenProvider() {
	const client = createApiClient("http://api.test", { getAccessToken });
	client.defaults.adapter = async (config) => ({
		data: { authorization: config.headers.get("Authorization") },
		status: 200,
		statusText: "OK",
		headers: {},
		config,
	});
	return client;
}

describe("getAccessToken wiring", () => {
	beforeEach(() => {
		useSessionStore.getState().clear();
	});

	it("reads the access token from the session store", () => {
		expect(getAccessToken()).toBeUndefined();

		useSessionStore.getState().setSession({ accessToken: "token-value" });

		expect(getAccessToken()).toBe("token-value");
	});

	it("attaches the bearer header when the store has a token", async () => {
		useSessionStore.getState().setSession({ accessToken: "token-value" });
		const client = clientWithTokenProvider();

		const response = await client.get("/companies");

		expect(response.data.authorization).toBe("Bearer token-value");
	});

	it("omits the header when the store has no token", async () => {
		const client = clientWithTokenProvider();

		const response = await client.get("/companies");

		expect(response.data.authorization).toBeUndefined();
	});
});
