import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ReactNode } from "react";
import { ApiError, createApiClient, getApiClient } from "@/lib/api/client";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { refreshSession } from "@/src/features/auth/session/refresh-session";
import { QueryProvider } from "@/src/providers/query-provider";
import { useSessionStore } from "@/src/store/session-store/session-store";
import { useLogin } from "../use-login";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function wrapper({ children }: { children: ReactNode }) {
	return <QueryProvider>{children}</QueryProvider>;
}

function mockPost(implementation: () => Promise<unknown>) {
	getApiClientMock.mockReturnValue({
		post: jest.fn(implementation),
	} as unknown as ReturnType<typeof getApiClient>);
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
			data: { error: { message: "Invalid credentials" } },
			headers: {},
			config,
		},
	);
}

describe("useLogin", () => {
	beforeEach(() => {
		useSessionStore.getState().clear();
		jest.clearAllMocks();
	});

	it("posts the credentials and stores the access token", async () => {
		const post = jest.fn(async () => ({
			data: { accessToken: "token-value", expiresIn: 3600 },
		}));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useLogin(), { wrapper });

		act(() => {
			result.current.mutate({
				email: "ana@empresa.com",
				password: "password123",
			});
		});

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(post).toHaveBeenCalledWith(
			"/auth/login",
			{ email: "ana@empresa.com", password: "password123" },
			{ skipAuthRefresh: true },
		);
		expect(useSessionStore.getState().accessToken).toBe("token-value");
	});

	it("surfaces the API error and leaves the session empty", async () => {
		mockPost(async () => {
			throw new ApiError("Invalid credentials", 401);
		});

		const { result } = renderHook(() => useLogin(), { wrapper });

		act(() => {
			result.current.mutate({ email: "ana@empresa.com", password: "wrong" });
		});

		await waitFor(() => {
			expect(result.current.isError).toBe(true);
		});
		expect(result.current.error).toBeInstanceOf(ApiError);
		expect(useSessionStore.getState().accessToken).toBeUndefined();
	});

	it("does not store a session when the response has the wrong shape", async () => {
		mockPost(async () => ({ data: { unexpected: true } }));

		const { result } = renderHook(() => useLogin(), { wrapper });

		act(() => {
			result.current.mutate({
				email: "ana@empresa.com",
				password: "password123",
			});
		});

		await waitFor(() => {
			expect(result.current.isError).toBe(true);
		});
		expect(useSessionStore.getState().accessToken).toBeUndefined();
	});

	it("does not refresh nor store a token when login returns 401", async () => {
		let refreshCalls = 0;
		const client = createApiClient("http://api.test", {
			getAccessToken,
			onUnauthorized: refreshSession,
		});
		client.defaults.adapter = async (config) => {
			if (config.url === "/auth/refresh") {
				refreshCalls += 1;
				return {
					data: { accessToken: "unwanted-token", expiresIn: 3600 },
					status: 200,
					statusText: "OK",
					headers: {},
					config,
				};
			}
			if (config.url === "/auth/login") {
				throw unauthorizedError(config);
			}
			throw new Error(`Unexpected url ${config.url}`);
		};
		getApiClientMock.mockReturnValue(client);

		const { result } = renderHook(() => useLogin(), { wrapper });

		act(() => {
			result.current.mutate({ email: "ana@empresa.com", password: "wrong" });
		});

		await waitFor(() => {
			expect(result.current.isError).toBe(true);
		});

		expect(refreshCalls).toBe(0);
		expect(useSessionStore.getState().accessToken).toBeUndefined();
	});
});
