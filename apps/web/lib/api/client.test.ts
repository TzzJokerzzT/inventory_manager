import {
	type AxiosAdapter,
	AxiosError,
	type AxiosInstance,
	type InternalAxiosRequestConfig,
} from "axios";
import { ApiError, createApiClient } from "./client";

const BASE_URL = "http://api.test";

function clientWithAdapter(adapter: AxiosAdapter) {
	const client = createApiClient(BASE_URL);
	client.defaults.adapter = adapter;
	return client;
}

function axiosErrorWith(status: number, data: unknown): AxiosError {
	return new AxiosError(
		"Request failed",
		"ERR_BAD_RESPONSE",
		undefined,
		undefined,
		{
			status,
			statusText: "Error",
			data,
			headers: {},
			config: { headers: {} } as never,
		},
	);
}

function unauthorizedError(config: InternalAxiosRequestConfig): AxiosError {
	return new AxiosError(
		"Request failed",
		"ERR_BAD_RESPONSE",
		config,
		undefined,
		{
			status: 401,
			statusText: "Error",
			data: { error: { message: "No autorizado" } },
			headers: {},
			config,
		},
	);
}

describe("createApiClient", () => {
	it("fails fast when no base URL is available", () => {
		const original = process.env.NEXT_PUBLIC_API_URL;
		// `delete` and not `= undefined`: assigning undefined to a process.env
		// entry stores the string "undefined", which is truthy and would defeat
		// the very check this test is about.
		delete process.env.NEXT_PUBLIC_API_URL;

		try {
			expect(() => createApiClient()).toThrow(/NEXT_PUBLIC_API_URL/);
		} finally {
			process.env.NEXT_PUBLIC_API_URL = original;
		}
	});

	it("sends credentials, because the refresh token is a cookie", () => {
		expect(createApiClient(BASE_URL).defaults.withCredentials).toBe(true);
	});

	it("passes a successful response through untouched", async () => {
		const client = clientWithAdapter(async (config) => ({
			data: { accessToken: "token-value" },
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		}));

		const response = await client.post("/auth/login");

		expect(response.data).toEqual({ accessToken: "token-value" });
	});
});

describe("error normalization", () => {
	it("surfaces the API message and the status", async () => {
		const client = clientWithAdapter(async () => {
			throw axiosErrorWith(401, { error: { message: "Invalid credentials" } });
		});

		await expect(client.post("/auth/login")).rejects.toMatchObject({
			name: "ApiError",
			message: "Invalid credentials",
			status: 401,
		});
	});

	it("captures the machine-readable code when the API sends one", async () => {
		const client = clientWithAdapter(async () => {
			throw axiosErrorWith(403, {
				error: { message: "Email not verified", code: "email_not_verified" },
			});
		});

		await expect(client.post("/auth/login")).rejects.toMatchObject({
			name: "ApiError",
			message: "Email not verified",
			status: 403,
			code: "email_not_verified",
		});
	});

	it("leaves the code undefined when the API sends none", async () => {
		const client = clientWithAdapter(async () => {
			throw axiosErrorWith(401, { error: { message: "Invalid credentials" } });
		});

		const error = await client.post("/auth/login").catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).code).toBeUndefined();
	});

	it("falls back to a generic message when the API sends none", async () => {
		const client = clientWithAdapter(async () => {
			throw axiosErrorWith(502, "<html>Bad gateway</html>");
		});

		const error = await client.get("/companies").catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).message).toBe(
			"No pudimos completar la operación.",
		);
		expect((error as ApiError).message).not.toContain("<html>");
		expect((error as ApiError).status).toBe(502);
	});

	it("reports a network failure as such, without a status", async () => {
		const client = clientWithAdapter(async () => {
			throw new AxiosError("Network Error", "ERR_NETWORK");
		});

		const error = await client.get("/health").catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).message).toBe(
			"No pudimos contactar al servidor.",
		);
		expect((error as ApiError).status).toBeUndefined();
	});

	it("leaves a canceled request alone", async () => {
		const client = clientWithAdapter(async () => {
			throw new AxiosError("canceled", "ERR_CANCELED");
		});

		const error = await client.get("/health").catch((e: unknown) => e);

		expect(error).not.toBeInstanceOf(ApiError);
		expect((error as AxiosError).code).toBe("ERR_CANCELED");
	});
});

describe("access-token interceptor", () => {
	function clientWithTokenProvider(getAccessToken: () => string | undefined) {
		const client = createApiClient(BASE_URL, { getAccessToken });
		client.defaults.adapter = async (config) => ({
			data: { authorization: config.headers.get("Authorization") },
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		});
		return client;
	}

	it("attaches the bearer token when the provider returns one", async () => {
		const client = clientWithTokenProvider(() => "token-value");

		const response = await client.get("/companies");

		expect(response.data.authorization).toBe("Bearer token-value");
	});

	it("omits the Authorization header when the provider returns none", async () => {
		const client = clientWithTokenProvider(() => undefined);

		const response = await client.get("/companies");

		expect(response.data.authorization).toBeUndefined();
	});
});

describe("401 refresh interceptor", () => {
	function clientWithRefresh(
		adapter: AxiosAdapter,
		onUnauthorized: () => Promise<void>,
	) {
		const client = createApiClient(BASE_URL, {
			getAccessToken: () => "token-value",
			onUnauthorized,
		});
		client.defaults.adapter = adapter;
		return client;
	}

	it("retries a 401 once after a successful refresh", async () => {
		let calls = 0;
		const onUnauthorized = jest.fn(async () => {});
		const client = clientWithRefresh(async (config) => {
			calls += 1;
			if (calls === 1) {
				throw unauthorizedError(config);
			}
			return {
				data: { id: "c1" },
				status: 200,
				statusText: "OK",
				headers: {},
				config,
			};
		}, onUnauthorized);

		const response = await client.get("/companies");

		expect(response.data).toEqual({ id: "c1" });
		expect(calls).toBe(2);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
	});

	it("does not retry when the refresh fails", async () => {
		let calls = 0;
		const onUnauthorized = jest.fn(async () => {
			throw new ApiError("No autorizado", 401);
		});
		const client = clientWithRefresh(async (config) => {
			calls += 1;
			throw unauthorizedError(config);
		}, onUnauthorized);

		await expect(client.get("/companies")).rejects.toMatchObject({
			status: 401,
		});

		expect(calls).toBe(1);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
	});

	it("retries the original request at most once", async () => {
		let calls = 0;
		const onUnauthorized = jest.fn(async () => {});
		const client = clientWithRefresh(async (config) => {
			calls += 1;
			throw unauthorizedError(config);
		}, onUnauthorized);

		await expect(client.get("/companies")).rejects.toMatchObject({
			status: 401,
		});

		expect(calls).toBe(2);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
	});

	it("never retries the refresh request itself", async () => {
		let refreshAttempts = 0;
		let client: AxiosInstance;
		client = createApiClient(BASE_URL, {
			getAccessToken: () => "token-value",
			onUnauthorized: async () => {
				await client.post("/auth/refresh", undefined, {
					skipAuthRefresh: true,
				});
			},
		});
		client.defaults.adapter = async (config) => {
			if (config.url === "/auth/refresh") {
				refreshAttempts += 1;
			}
			throw unauthorizedError(config);
		};

		await expect(client.get("/companies")).rejects.toMatchObject({
			status: 401,
		});

		expect(refreshAttempts).toBe(1);
	});
});
