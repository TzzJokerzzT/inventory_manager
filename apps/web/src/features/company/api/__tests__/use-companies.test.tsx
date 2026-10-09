import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { useCompanies } from "../use-companies";

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

describe("useCompanies", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("fetches the companies and parses them at the boundary", async () => {
		const companies = [
			{ id: "c1", name: "Primera", createdAt: "2026-10-06T00:00:00.000Z" },
			{ id: "c2", name: "Segunda", createdAt: "2026-10-06T01:00:00.000Z" },
		];
		mockGet(companies);

		const { result } = renderHook(() => useCompanies(), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(result.current.data).toEqual(companies);
	});

	it("surfaces a data error when the response has the wrong shape", async () => {
		mockGet({ unexpected: true });

		const { result } = renderHook(() => useCompanies(), { wrapper });

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

	it("reads the companies through the wired access-token provider", async () => {
		mockGet([]);

		renderHook(() => useCompanies(), { wrapper });

		await waitFor(() => {
			expect(getApiClientMock).toHaveBeenCalledWith(
				expect.objectContaining({
					getAccessToken: expect.any(Function),
				}),
			);
		});
	});
});
