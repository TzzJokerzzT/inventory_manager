import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { getApiClient } from "@/lib/api/client";
import { useInviteMember } from "../use-invite-member";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function member(overrides: Record<string, unknown> = {}) {
	return {
		id: "m2",
		userId: null,
		invitedEmail: "nuevo@empresa.com",
		companyId: "c1",
		role: "MEMBER",
		status: "INVITED",
		invitedBy: "user-1",
		acceptedAt: null,
		createdAt: "2026-10-06T00:00:00.000Z",
		updatedAt: "2026-10-06T00:00:00.000Z",
		...overrides,
	};
}

function wrapperFor(queryClient: QueryClient) {
	return function wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

describe("useInviteMember", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("posts the email and role and returns the created membership", async () => {
		const created = member();
		const post = jest.fn(async () => ({ data: created }));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useInviteMember("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync({
			email: "nuevo@empresa.com",
			role: "MEMBER",
		});

		expect(post).toHaveBeenCalledWith("/companies/c1/members", {
			email: "nuevo@empresa.com",
			role: "MEMBER",
		});
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["members", "c1"] });
	});

	it("fails at the boundary when the API answers the wrong shape", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => ({ data: { id: "m2" } })),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});

		const { result } = renderHook(() => useInviteMember("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ email: "a@b.com", role: "MEMBER" }),
		).rejects.toThrow(/respuesta inesperada/);
	});
});
