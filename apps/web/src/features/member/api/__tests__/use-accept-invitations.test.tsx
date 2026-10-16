import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useAcceptInvitations } from "../use-accept-invitations";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function accepted() {
	return {
		id: "m1",
		userId: "user-1",
		invitedEmail: "ana@empresa.com",
		companyId: "c1",
		role: "MEMBER",
		status: "ACTIVE",
		invitedBy: "user-2",
		acceptedAt: "2026-10-06T00:00:00.000Z",
		createdAt: "2026-10-06T00:00:00.000Z",
		updatedAt: "2026-10-06T00:00:00.000Z",
	};
}

function wrapperFor(queryClient: QueryClient) {
	return function wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

function mockPost(data: unknown) {
	const post = jest.fn(async () => ({ data }));
	getApiClientMock.mockReturnValue({
		post,
	} as unknown as ReturnType<typeof getApiClient>);
	return post;
}

describe("useAcceptInvitations", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("posts to the accept endpoint and refreshes companies and me", async () => {
		const post = mockPost([accepted()]);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useAcceptInvitations(), {
			wrapper: wrapperFor(queryClient),
		});

		const answer = await result.current.mutateAsync();

		expect(post).toHaveBeenCalledWith("/me/invitations/accept");
		expect(answer).toHaveLength(1);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["companies"] });
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["me"] });
		// The accepted invitation is gone, so the panel section that renders it
		// must re-read and disappear.
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: ["pending-invitations"],
		});
	});

	it("accepts the empty list as the normal 'nothing pending' answer", async () => {
		mockPost([]);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		const { result } = renderHook(() => useAcceptInvitations(), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(result.current.mutateAsync()).resolves.toEqual([]);
	});

	it("fails at the boundary when the response has the wrong shape", async () => {
		mockPost({ accepted: [] });
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});

		const { result } = renderHook(() => useAcceptInvitations(), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(result.current.mutateAsync()).rejects.toBeInstanceOf(ApiError);
	});
});
