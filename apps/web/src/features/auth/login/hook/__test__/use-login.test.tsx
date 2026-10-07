import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
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
		expect(post).toHaveBeenCalledWith("/auth/login", {
			email: "ana@empresa.com",
			password: "password123",
		});
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
});
