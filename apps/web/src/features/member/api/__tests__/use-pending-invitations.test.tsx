import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { usePendingInvitations } from "../use-pending-invitations";

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

function invitation(overrides: Record<string, unknown> = {}) {
	return {
		membershipId: "m1",
		companyId: "c1",
		role: "MEMBER",
		invitedAt: "2026-01-02T03:04:05.000Z",
		company: {
			id: "c1",
			name: "Acme",
			createdAt: "2026-01-01T00:00:00.000Z",
		},
		inviter: { id: "u1", fullName: "Ana Pérez", email: "ana@empresa.com" },
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

describe("usePendingInvitations", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the caller's invitations and parses them at the boundary", async () => {
		const invitations = [invitation()];
		const get = mockGet(invitations);

		const { result } = renderHook(() => usePendingInvitations(), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/me/invitations");
		expect(result.current.data).toEqual(invitations);
	});

	it("accepts an empty list, the normal case when nothing is pending", async () => {
		mockGet([]);

		const { result } = renderHook(() => usePendingInvitations(), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(result.current.data).toEqual([]);
	});

	it("surfaces a data error when the response shape is wrong", async () => {
		mockGet({ unexpected: true });

		const { result } = renderHook(() => usePendingInvitations(), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});
});
