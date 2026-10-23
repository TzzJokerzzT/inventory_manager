import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useCreateProduct } from "../use-create-product";

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

function wrapperFor(queryClient: QueryClient) {
	return function wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

function newQueryClient() {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("useCreateProduct", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("posts the body and returns the created product", async () => {
		const created = product();
		const post = jest.fn(async () => ({ data: created }));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useCreateProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		const response = await result.current.mutateAsync({
			name: "Café molido 500g",
			sku: "CAF-500",
			price: "1500.00",
			description: null,
			photoUrl: null,
		});

		expect(post).toHaveBeenCalledWith("/companies/c1/products", {
			name: "Café molido 500g",
			sku: "CAF-500",
			price: "1500.00",
			description: null,
			photoUrl: null,
		});
		expect(response).toEqual(created);
		// The per-company prefix, so every cached search refreshes.
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["products", "c1"] });
	});

	it("fails at the boundary when the API answers the wrong shape", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => ({ data: { id: "p1" } })),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});

		const { result } = renderHook(() => useCreateProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({
				name: "Café",
				sku: "CAF-500",
				price: "1500.00",
			}),
		).rejects.toThrow(/respuesta inesperada/);
	});

	it("surfaces the duplicate-SKU conflict as the ApiError the API sent", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => {
				throw new ApiError("Ese SKU ya existe.", 409, "sku_already_exists");
			}),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});

		const { result } = renderHook(() => useCreateProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({
				name: "Café",
				sku: "CAF-500",
				price: "1500.00",
			}),
		).rejects.toMatchObject({ status: 409, code: "sku_already_exists" });
	});
});
