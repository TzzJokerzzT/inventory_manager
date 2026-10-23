import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { productQueryKey, useProduct } from "../use-product";

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

function product() {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: "Molido medio",
		sku: "CAF-500",
		price: "1500.00",
		photoUrl: null,
		stockQuantity: 4,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
	};
}

function mockGet(data: unknown) {
	const get = jest.fn(async () => ({ data }));
	getApiClientMock.mockReturnValue({
		get,
	} as unknown as ReturnType<typeof getApiClient>);
	return get;
}

describe("productQueryKey", () => {
	it("scopes the detail to its company and its product", () => {
		expect(productQueryKey("c1", "p1")).toEqual(["product", "c1", "p1"]);
	});
});

describe("useProduct", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads one product so a direct navigation works with a cold cache", async () => {
		const stored = product();
		const get = mockGet(stored);

		const { result } = renderHook(() => useProduct("c1", "p1"), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/products/p1");
		expect(result.current.data).toEqual(stored);
	});

	it("does not call the API without a company or a product", () => {
		const get = mockGet(product());

		const withoutCompany = renderHook(() => useProduct(undefined, "p1"), {
			wrapper,
		});
		const withoutProduct = renderHook(() => useProduct("c1", undefined), {
			wrapper,
		});

		expect(get).not.toHaveBeenCalled();
		expect(withoutCompany.result.current.fetchStatus).toBe("idle");
		expect(withoutProduct.result.current.fetchStatus).toBe("idle");
	});

	it("surfaces a data error when the product shape is wrong", async () => {
		mockGet({ id: "p1" });

		const { result } = renderHook(() => useProduct("c1", "p1"), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});
});
