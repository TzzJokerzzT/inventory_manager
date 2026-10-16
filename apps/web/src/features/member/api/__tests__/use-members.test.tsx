import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { useMembers } from "../use-members";

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

function membership(id: string, role: string, status: string) {
	return {
		id,
		userId: status === "INVITED" ? null : "user-1",
		invitedEmail: `${id}@empresa.com`,
		companyId: "c1",
		role,
		status,
		invitedBy: "user-1",
		acceptedAt: status === "INVITED" ? null : "2026-10-06T00:00:00.000Z",
		createdAt: "2026-10-06T00:00:00.000Z",
		updatedAt: "2026-10-06T00:00:00.000Z",
	};
}

function mockGet(data: unknown) {
	const get = jest.fn(async () => ({ data }));
	getApiClientMock.mockReturnValue({
		get,
	} as unknown as ReturnType<typeof getApiClient>);
	return get;
}

describe("useMembers", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the active company's roster and parses it at the boundary", async () => {
		const roster = [
			membership("m1", "OWNER", "ACTIVE"),
			membership("m2", "MEMBER", "INVITED"),
		];
		const get = mockGet(roster);

		const { result } = renderHook(() => useMembers("c1"), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/members");
		expect(result.current.data).toEqual(roster);
	});

	it("does not call the API without an active company", () => {
		const get = mockGet([]);

		const { result } = renderHook(() => useMembers(undefined), { wrapper });

		expect(get).not.toHaveBeenCalled();
		expect(result.current.fetchStatus).toBe("idle");
	});

	it("surfaces a data error when the roster shape is wrong", async () => {
		mockGet({ unexpected: true });

		const { result } = renderHook(() => useMembers("c1"), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});
});
