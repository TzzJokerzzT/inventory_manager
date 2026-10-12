import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { getApiClient } from "@/lib/api/client";
import { useLeaveCompany } from "../use-leave-company";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function revokedSelf() {
	return {
		id: "m1",
		userId: "user-1",
		invitedEmail: "ana@empresa.com",
		companyId: "c1",
		role: "MEMBER",
		status: "REVOKED",
		invitedBy: "user-1",
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

describe("useLeaveCompany", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("deletes the caller's own membership and refreshes the app state", async () => {
		const remove = jest.fn(async () => ({ data: revokedSelf() }));
		getApiClientMock.mockReturnValue({
			delete: remove,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useLeaveCompany("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync();

		expect(remove).toHaveBeenCalledWith("/companies/c1/members/me");
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["members", "c1"] });
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["companies"] });
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["me"] });
	});
});
