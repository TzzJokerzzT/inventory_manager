import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { getApiClient } from "@/lib/api/client";
import { useMarkNotificationsRead } from "../use-mark-notifications-read";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function wrapperFor(queryClient: QueryClient) {
	return function wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

function mockPost() {
	const post = jest.fn(async () => ({ data: undefined }));
	getApiClientMock.mockReturnValue({
		post,
	} as unknown as ReturnType<typeof getApiClient>);
	return post;
}

describe("useMarkNotificationsRead", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("posts the mark-all action and refreshes the notifications read", async () => {
		const post = mockPost();
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useMarkNotificationsRead(), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync();

		expect(post).toHaveBeenCalledWith("/me/notifications/read");
		// The read invalidates the list so the unread highlight clears.
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["notifications"] });
	});
});
