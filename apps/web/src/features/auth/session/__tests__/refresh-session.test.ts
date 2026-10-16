import {
	type AxiosAdapter,
	AxiosError,
	type InternalAxiosRequestConfig,
} from "axios";
import { ApiError, createApiClient, getApiClient } from "@/lib/api/client";
import { useSessionStore } from "@/src/store/session-store/session-store";
import { getAccessToken } from "../../api/get-access-token";
import { refreshSession } from "../refresh-session";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function axiosErrorWith(
	status: number,
	config: InternalAxiosRequestConfig,
): AxiosError {
	return new AxiosError(
		"Request failed",
		"ERR_BAD_RESPONSE",
		config,
		undefined,
		{
			status,
			statusText: "Error",
			data: { error: { message: "No autorizado" } },
			headers: {},
			config,
		},
	);
}

const COMPANIES = [
	{ id: "c1", name: "Primera", createdAt: "2026-10-06T00:00:00.000Z" },
];

function clientWithAdapter(adapter: AxiosAdapter) {
	const client = createApiClient("http://api.test", {
		getAccessToken,
		onUnauthorized: refreshSession,
	});
	client.defaults.adapter = adapter;
	getApiClientMock.mockReturnValue(client);
	return client;
}

describe("refreshSession", () => {
	beforeEach(() => {
		useSessionStore.setState({ accessToken: undefined, resolved: false });
		jest.clearAllMocks();
	});

	it("shares one refresh across concurrent 401s and retries both requests once", async () => {
		let refreshCalls = 0;

		const client = clientWithAdapter(async (config) => {
			if (config.url === "/auth/refresh") {
				refreshCalls += 1;
				return {
					data: { accessToken: "fresh-token", expiresIn: 3600 },
					status: 200,
					statusText: "OK",
					headers: {},
					config,
				};
			}
			if (config.url === "/companies") {
				if (!config.headers.get("Authorization")) {
					throw axiosErrorWith(401, config);
				}
				return {
					data: COMPANIES,
					status: 200,
					statusText: "OK",
					headers: {},
					config,
				};
			}
			throw new Error(`Unexpected url ${config.url}`);
		});

		const [first, second] = await Promise.all([
			client.get("/companies"),
			client.get("/companies"),
		]);

		expect(first.data).toEqual(COMPANIES);
		expect(second.data).toEqual(COMPANIES);
		expect(refreshCalls).toBe(1);
		expect(useSessionStore.getState().accessToken).toBe("fresh-token");
	});

	it("clears the session and does not loop when the refresh itself is rejected", async () => {
		let refreshCalls = 0;

		const client = clientWithAdapter(async (config) => {
			if (config.url === "/auth/refresh") {
				refreshCalls += 1;
			}
			throw axiosErrorWith(401, config);
		});

		await expect(client.get("/companies")).rejects.toMatchObject({
			status: 401,
		});

		expect(refreshCalls).toBe(1);
		expect(useSessionStore.getState().accessToken).toBeUndefined();
	});

	it("clears a previously stored token when the refresh fails", async () => {
		useSessionStore.getState().setSession({ accessToken: "stale-token" });
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => {
				throw new ApiError("No autorizado", 401);
			}),
		} as unknown as ReturnType<typeof getApiClient>);

		await expect(refreshSession()).rejects.toMatchObject({ status: 401 });

		expect(useSessionStore.getState().accessToken).toBeUndefined();
	});
});
