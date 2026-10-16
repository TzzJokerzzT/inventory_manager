import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { getApiClient } from "@/lib/api/client";
import { useChangeMemberRole } from "../use-change-member-role";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function member(role: string) {
	return {
		id: "m2",
		userId: "user-2",
		invitedEmail: "otro@empresa.com",
		companyId: "c1",
		role,
		status: "ACTIVE",
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

describe("useChangeMemberRole", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("patches the membership role and refreshes the roster", async () => {
		const patch = jest.fn(async () => ({ data: member("ADMIN") }));
		getApiClientMock.mockReturnValue({
			patch,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useChangeMemberRole("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync({ membershipId: "m2", role: "ADMIN" });

		expect(patch).toHaveBeenCalledWith("/companies/c1/members/m2", {
			role: "ADMIN",
		});
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["members", "c1"] });
	});

	it("never calls the API without an active company", async () => {
		const patch = jest.fn();
		getApiClientMock.mockReturnValue({
			patch,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});

		const { result } = renderHook(() => useChangeMemberRole(undefined), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ membershipId: "m2", role: "ADMIN" }),
		).rejects.toThrow("No active company");
		expect(patch).not.toHaveBeenCalled();
	});
});
