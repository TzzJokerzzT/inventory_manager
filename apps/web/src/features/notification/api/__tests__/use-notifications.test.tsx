import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { useNotifications } from "../use-notifications";

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

function notification(overrides: Record<string, unknown> = {}) {
	return {
		id: "n1",
		type: "membership.accepted",
		createdAt: "2026-10-06T00:00:00.000Z",
		readAt: null,
		company: {
			id: "c1",
			name: "Acme",
			createdAt: "2026-10-01T00:00:00.000Z",
		},
		actor: null,
		...overrides,
	};
}

function mockGet(data: unknown) {
	const get = jest.fn(async () => ({ data }));
	getApiClientMock.mockReturnValue({
		get,
	} as unknown as ReturnType<typeof getApiClient>);
	return get;
}

describe("useNotifications", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the caller's notifications and parses them at the boundary", async () => {
		const notifications = [notification()];
		const get = mockGet(notifications);

		const { result } = renderHook(() => useNotifications(), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/me/notifications");
		expect(result.current.data).toEqual(notifications);
	});

	it("accepts an empty list, the normal case when there is no news", async () => {
		mockGet([]);

		const { result } = renderHook(() => useNotifications(), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(result.current.data).toEqual([]);
	});

	it("surfaces a data error when the response shape is wrong", async () => {
		mockGet({ unexpected: true });

		const { result } = renderHook(() => useNotifications(), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});
});
