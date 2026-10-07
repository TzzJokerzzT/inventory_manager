import { type AxiosAdapter, AxiosError } from "axios";
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
