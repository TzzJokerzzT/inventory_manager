import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useUpdateCategory } from "../use-update-category";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

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

describe("useUpdateCategory", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("patches the category with the only writable field", async () => {
		const updated = category({ name: "Bebidas sin alcohol" });
		const patch = jest.fn(async () => ({ data: updated }));
		getApiClientMock.mockReturnValue({
			patch,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useUpdateCategory("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		const response = await result.current.mutateAsync({
			categoryId: "ca1",
			name: "Bebidas sin alcohol",
		});

		// `categoryId` is the target of the request, never part of the body.
		expect(patch).toHaveBeenCalledWith("/companies/c1/categories/ca1", {
			name: "Bebidas sin alcohol",
		});
		expect(response).toEqual(updated);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["categories", "c1"] });
	});

	it("surfaces a 404 as the ApiError the API sent", async () => {
		getApiClientMock.mockReturnValue({
			patch: jest.fn(async () => {
				throw new ApiError("Category not found", 404, "category_not_found");
			}),
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useUpdateCategory("c1"), {
			wrapper: wrapperFor(newQueryClient()),
		});

		await expect(
			result.current.mutateAsync({ categoryId: "ca1", name: "Lácteos" }),
		).rejects.toMatchObject({ status: 404, code: "category_not_found" });
	});
});
