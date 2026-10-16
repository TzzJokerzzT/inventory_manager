import { act, renderHook } from "@testing-library/react";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useRouter } from "next/navigation";
import { ApiError, createApiClient, getApiClient } from "@/lib/api/client";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { refreshSession } from "@/src/features/auth/session/refresh-session";
import { useSessionStore } from "@/src/store/session-store/session-store";
import { useLogout } from "../use-logout";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;
const replace = jest.fn();

function mockRouter() {
	useRouterMock.mockReturnValue({
		replace,
		push: jest.fn(),
		refresh: jest.fn(),
		back: jest.fn(),
		forward: jest.fn(),
		prefetch: jest.fn(),
	} as unknown as ReturnType<typeof useRouter>);
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

describe("useLogout", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useSessionStore.setState({ accessToken: undefined, resolved: false });
		mockRouter();
	});

	it("logs out, clears the session and redirects to /login", async () => {
		useSessionStore.getState().setSession({ accessToken: "token-value" });
		const post = jest.fn(async () => ({ data: undefined }));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useLogout());

		await act(async () => {
			await result.current();
		});

		expect(post).toHaveBeenCalledWith("/auth/logout", undefined, {
			skipAuthRefresh: true,
		});
		expect(useSessionStore.getState().accessToken).toBeUndefined();
		expect(replace).toHaveBeenCalledWith("/login");
	});

	it("still clears and redirects when the logout request fails", async () => {
		useSessionStore.getState().setSession({ accessToken: "token-value" });
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => {
				throw new ApiError("No pudimos contactar al servidor.");
			}),
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useLogout());

		await act(async () => {
			await result.current();
		});

		expect(useSessionStore.getState().accessToken).toBeUndefined();
		expect(replace).toHaveBeenCalledWith("/login");
	});

	it("does not trigger a refresh when logout returns 401", async () => {
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
			if (config.url === "/auth/logout") {
				throw unauthorizedError(config);
			}
			throw new Error(`Unexpected url ${config.url}`);
		};
		getApiClientMock.mockReturnValue(client);

		const { result } = renderHook(() => useLogout());

		await act(async () => {
			await result.current();
		});

		expect(refreshCalls).toBe(0);
		expect(useSessionStore.getState().accessToken).toBeUndefined();
		expect(replace).toHaveBeenCalledWith("/login");
	});
});
