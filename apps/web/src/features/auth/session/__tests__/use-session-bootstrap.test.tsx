import { renderHook, waitFor } from "@testing-library/react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useSessionStore } from "@/src/store/session-store/session-store";
import { useSessionBootstrap } from "../use-session-bootstrap";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

describe("useSessionBootstrap", () => {
	beforeEach(() => {
		useSessionStore.setState({ accessToken: undefined, resolved: false });
		jest.clearAllMocks();
	});

	it("refreshes once and stores the token when there is none", async () => {
		const post = jest.fn(async () => ({
			data: { accessToken: "fresh-token", expiresIn: 3600 },
		}));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);

		renderHook(() => useSessionBootstrap());

		await waitFor(() => {
			expect(useSessionStore.getState().resolved).toBe(true);
		});

		expect(useSessionStore.getState().accessToken).toBe("fresh-token");
		expect(post).toHaveBeenCalledTimes(1);
	});

	it("resolves and leaves the session cleared when the refresh fails", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => {
				throw new ApiError("No autorizado", 401);
			}),
		} as unknown as ReturnType<typeof getApiClient>);

		renderHook(() => useSessionBootstrap());

		await waitFor(() => {
			expect(useSessionStore.getState().resolved).toBe(true);
		});

		expect(useSessionStore.getState().accessToken).toBeUndefined();
	});

	it("skips the refresh and just resolves when a token already exists", async () => {
		useSessionStore.getState().setSession({ accessToken: "existing-token" });
		const post = jest.fn();
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);

		renderHook(() => useSessionBootstrap());

		await waitFor(() => {
			expect(useSessionStore.getState().resolved).toBe(true);
		});

		expect(post).not.toHaveBeenCalled();
		expect(useSessionStore.getState().accessToken).toBe("existing-token");
	});
});
