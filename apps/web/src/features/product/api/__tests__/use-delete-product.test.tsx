import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useDeleteProduct } from "../use-delete-product";

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

describe("useDeleteProduct", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("soft-deletes the product and refreshes the catalogue", async () => {
		const remove = jest.fn(async () => ({ status: 204, data: undefined }));
		getApiClientMock.mockReturnValue({
			delete: remove,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useDeleteProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync({ productId: "p1" });

		expect(remove).toHaveBeenCalledWith("/companies/c1/products/p1");
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["products", "c1"] });
	});

	it("keeps the product when the API rejects the deletion", async () => {
		getApiClientMock.mockReturnValue({
			delete: jest.fn(async () => {
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
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useDeleteProduct("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ productId: "p1" }),
		).rejects.toMatchObject({ status: 403, code: "insufficient_role" });
		expect(invalidate).not.toHaveBeenCalled();
	});
});
