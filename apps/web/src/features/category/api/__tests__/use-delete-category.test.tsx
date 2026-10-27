import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useDeleteCategory } from "../use-delete-category";

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

describe("useDeleteCategory", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("deletes the category and refreshes the company's catalogue", async () => {
		const remove = jest.fn(async () => ({ data: undefined }));
		getApiClientMock.mockReturnValue({
			delete: remove,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useDeleteCategory("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync({ categoryId: "ca1" });

		expect(remove).toHaveBeenCalledWith("/companies/c1/categories/ca1");
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["categories", "c1"] });
	});

	it("surfaces a 409 category_in_use as the ApiError the API sent", async () => {
		getApiClientMock.mockReturnValue({
			delete: jest.fn(async () => {
				throw new ApiError(
					"Category is in use by 2 products and cannot be deleted",
					409,
					"category_in_use",
				);
			}),
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useDeleteCategory("c1"), {
			wrapper: wrapperFor(
				new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
			),
		});

		await expect(
			result.current.mutateAsync({ categoryId: "ca1" }),
		).rejects.toMatchObject({ status: 409, code: "category_in_use" });
	});

	it("refuses to call the API without an active company", async () => {
		const remove = jest.fn();
		getApiClientMock.mockReturnValue({
			delete: remove,
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useDeleteCategory(undefined), {
			wrapper: wrapperFor(
				new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
			),
		});

		await expect(
			result.current.mutateAsync({ categoryId: "ca1" }),
		).rejects.toThrow(/No active company/);
		expect(remove).not.toHaveBeenCalled();
	});
});
