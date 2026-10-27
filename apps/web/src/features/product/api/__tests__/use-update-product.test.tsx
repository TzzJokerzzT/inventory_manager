import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useUpdateProduct } from "../use-update-product";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function product(overrides: Record<string, unknown> = {}) {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 1kg",
		description: null,
		sku: "CAF-1000",
		price: "2900.00",
		photoUrl: null,
		stockQuantity: 0,
		lowStockThreshold: 0,
		measureUnit: "KILOGRAM",
		categoryId: null,
		categoryName: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-21T12:00:00.000Z",
		...overrides,
	};
}

function wrapperFor(queryClient: QueryClient) {
	return function wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

describe("useUpdateProduct", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("patches only the changed fields and returns the updated product", async () => {
		const updated = product();
		const patch = jest.fn(async () => ({ data: updated }));
		getApiClientMock.mockReturnValue({
			patch,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useUpdateProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		const response = await result.current.mutateAsync({
			productId: "p1",
			price: "2900.00",
			photoUrl: null,
		});

		expect(patch).toHaveBeenCalledWith("/companies/c1/products/p1", {
			price: "2900.00",
			photoUrl: null,
		});
		expect(response).toEqual(updated);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["products", "c1"] });
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: ["product", "c1", "p1"],
		});
	});

	it("surfaces the insufficient-role rejection as the ApiError the API sent", async () => {
		getApiClientMock.mockReturnValue({
			patch: jest.fn(async () => {
				throw new ApiError(
					"Tu rol no permite esta acción.",
					403,
					"insufficient_role",
				);
			}),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});

		const { result } = renderHook(() => useUpdateProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ productId: "p1", name: "Otro" }),
		).rejects.toMatchObject({ status: 403, code: "insufficient_role" });
	});
});
