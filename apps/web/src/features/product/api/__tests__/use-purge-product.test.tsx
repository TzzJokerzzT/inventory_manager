import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { usePurgeProduct } from "../use-purge-product";

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

describe("usePurgeProduct", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("purges the product and refreshes both the catalogue and the trash", async () => {
		const remove = jest.fn(async () => ({ status: 204, data: undefined }));
		getApiClientMock.mockReturnValue({
			delete: remove,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => usePurgeProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync({ productId: "p1" });

		expect(remove).toHaveBeenCalledWith("/companies/c1/products/p1/permanent");
		// The prefix covers every cached search of the company, active and trash.
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["products", "c1"] });
	});

	it("surfaces product_has_movements and keeps the cache when the API rejects", async () => {
		const remove = jest.fn(async () => {
			throw new ApiError(
				"El producto tiene 3 movimientos y no se puede eliminar definitivamente.",
				409,
				"product_has_movements",
			);
		});
		getApiClientMock.mockReturnValue({
			delete: remove,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => usePurgeProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ productId: "p1" }),
		).rejects.toMatchObject({ status: 409, code: "product_has_movements" });
		expect(invalidate).not.toHaveBeenCalled();
	});

	it("surfaces product_not_deleted and keeps the cache when the product is active", async () => {
		const remove = jest.fn(async () => {
			throw new ApiError(
				"El producto no está dado de baja.",
				409,
				"product_not_deleted",
			);
		});
		getApiClientMock.mockReturnValue({
			delete: remove,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => usePurgeProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ productId: "p1" }),
		).rejects.toMatchObject({ status: 409, code: "product_not_deleted" });
		expect(invalidate).not.toHaveBeenCalled();
	});
});
