import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import {
	categoriesQueryKey,
	categoriesQueryPrefix,
	useCategories,
} from "../use-categories";

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

function category(overrides: Record<string, unknown> = {}) {
	return {
		id: "ca1",
		companyId: "c1",
		name: "Bebidas",
		createdAt: "2026-10-22T12:00:00.000Z",
		updatedAt: "2026-10-22T12:00:00.000Z",
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

describe("categoriesQueryPrefix", () => {
	it("scopes every cached read to its company", () => {
		expect(categoriesQueryPrefix("c1")).toEqual(["categories", "c1"]);
		expect(categoriesQueryPrefix("c2")).toEqual(["categories", "c2"]);
		// The prefix is what the mutations invalidate, so it must cover the key
		// the list actually uses.
		expect(categoriesQueryKey("c1")).toEqual(["categories", "c1"]);
	});
});

describe("useCategories", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the active company's catalogue and parses it at the boundary", async () => {
		const list = [category(), category({ id: "ca2", name: "Lácteos" })];
		const get = mockGet(list);

		const { result } = renderHook(() => useCategories("c1"), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/categories", undefined);
		expect(result.current.data).toEqual(list);
	});

	it("does not call the API without an active company", () => {
		const get = mockGet([]);

		const { result } = renderHook(() => useCategories(undefined), { wrapper });

		expect(get).not.toHaveBeenCalled();
		expect(result.current.fetchStatus).toBe("idle");
	});

	it("surfaces a data error when the list shape is wrong", async () => {
		mockGet({ categories: [] });

		const { result } = renderHook(() => useCategories("c1"), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});
});
