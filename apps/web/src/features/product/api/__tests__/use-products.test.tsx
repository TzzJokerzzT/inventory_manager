import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { productsQueryKey, useProducts } from "../use-products";

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

function product(overrides: Record<string, unknown> = {}) {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		photoUrl: null,
		stockQuantity: 0,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
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

describe("productsQueryKey", () => {
	it("scopes every cached search to its company and its term", () => {
		expect(productsQueryKey("c1")).toEqual(["products", "c1", ""]);
		expect(productsQueryKey("c1", "café")).toEqual(["products", "c1", "café"]);
		expect(productsQueryKey("c2", "café")).toEqual(["products", "c2", "café"]);
	});
});

describe("useProducts", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the active company's catalogue and parses it at the boundary", async () => {
		const catalogue = [product(), product({ id: "p2", sku: "YER-1" })];
		const get = mockGet(catalogue);

		const { result } = renderHook(() => useProducts("c1"), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/products", undefined);
		expect(result.current.data).toEqual(catalogue);
	});

	it("sends the search term as a query parameter", async () => {
		const get = mockGet([]);

		const { result } = renderHook(() => useProducts("c1", "café"), {
			wrapper,
		});

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/products", {
			params: { search: "café" },
		});
	});

	it("trims the term and omits it when it is blank", async () => {
		const get = mockGet([]);

		const { result } = renderHook(() => useProducts("c1", "   "), {
			wrapper,
		});

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/products", undefined);
	});

	it("does not call the API without an active company", () => {
		const get = mockGet([]);

		const { result } = renderHook(() => useProducts(undefined), { wrapper });

		expect(get).not.toHaveBeenCalled();
		expect(result.current.fetchStatus).toBe("idle");
	});

	it("surfaces a data error when the catalogue shape is wrong", async () => {
		mockGet({ products: [] });

		const { result } = renderHook(() => useProducts("c1"), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});
});
