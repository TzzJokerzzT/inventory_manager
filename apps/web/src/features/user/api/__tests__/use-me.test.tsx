import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { useMe } from "../use-me";

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

function mockGet(data: unknown) {
	getApiClientMock.mockReturnValue({
		get: jest.fn(async () => ({ data })),
	} as unknown as ReturnType<typeof getApiClient>);
}

function meResponse(overrides: Record<string, unknown> = {}) {
	return {
		id: "user-1",
		email: "ana@empresa.com",
		fullName: "Ana Pérez",
		createdAt: "2026-10-06T00:00:00.000Z",
		memberships: [
			{
				companyId: "c1",
				role: "OWNER",
				company: {
					id: "c1",
					name: "Primera",
					createdAt: "2026-10-06T00:00:00.000Z",
				},
			},
		],
		...overrides,
	};
}

describe("useMe", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("fetches /me and parses the identity at the boundary", async () => {
		const me = meResponse();
		mockGet(me);

		const { result } = renderHook(() => useMe(), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(result.current.data).toEqual(me);
		expect(result.current.data?.memberships[0].role).toBe("OWNER");
	});

	it("surfaces a data error when the response has the wrong shape", async () => {
		mockGet({ unexpected: true });

		const { result } = renderHook(() => useMe(), { wrapper });

		// `retry: 1` means the error is only final after the retry delay, so the
		// assertion needs more than the default one-second `waitFor` budget.
		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});

	it("reads /me through the wired access-token provider", async () => {
		mockGet(meResponse());

		renderHook(() => useMe(), { wrapper });

		await waitFor(() => {
			expect(getApiClientMock).toHaveBeenCalledWith(
				expect.objectContaining({
					getAccessToken: expect.any(Function),
				}),
			);
		});
	});
});
