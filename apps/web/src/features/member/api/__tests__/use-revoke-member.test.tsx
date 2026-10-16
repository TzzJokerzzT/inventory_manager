import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { getApiClient } from "@/lib/api/client";
import { useRevokeMember } from "../use-revoke-member";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function revoked() {
	return {
		id: "m2",
		userId: "user-2",
		invitedEmail: "otro@empresa.com",
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

describe("useRevokeMember", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("deletes the membership and refreshes the roster", async () => {
		const remove = jest.fn(async () => ({ data: revoked() }));
		getApiClientMock.mockReturnValue({
			delete: remove,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useRevokeMember("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		const answer = await result.current.mutateAsync({ membershipId: "m2" });

		expect(remove).toHaveBeenCalledWith("/companies/c1/members/m2");
		expect(answer.status).toBe("REVOKED");
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["members", "c1"] });
	});
});
