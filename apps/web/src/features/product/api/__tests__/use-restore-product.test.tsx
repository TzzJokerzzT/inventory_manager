import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import type { Product as ProductModel } from "@/lib/api/schemas";
import { useRestoreProduct } from "../use-restore-product";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function wrapperFor(queryClient: QueryClient) {
	return function wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

function product(): ProductModel {
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
	};
}

describe("useRestoreProduct", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("restores the product and refreshes both the catalogue and the trash", async () => {
		const restored = product();
		const post = jest.fn(async () => ({ status: 200, data: restored }));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useRestoreProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		const value = await result.current.mutateAsync({ productId: "p1" });

		expect(post).toHaveBeenCalledWith("/companies/c1/products/p1/restore");
		expect(value).toEqual(restored);
		// The prefix covers every cached search of the company, active and trash.
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["products", "c1"] });
	});

	it("surfaces product_not_deleted and keeps the cache when the API rejects", async () => {
		const post = jest.fn(async () => {
			throw new ApiError(
				"El producto ya está activo.",
				409,
				"product_not_deleted",
			);
		});
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useRestoreProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ productId: "p1" }),
		).rejects.toMatchObject({ status: 409, code: "product_not_deleted" });
		expect(invalidate).not.toHaveBeenCalled();
	});
});
