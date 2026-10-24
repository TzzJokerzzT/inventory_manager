import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useDeleteProvider } from "../use-delete-provider";

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

describe("useDeleteProvider", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("deletes the supplier and refreshes the company's roster", async () => {
		const remove = jest.fn(async () => ({ data: undefined }));
		getApiClientMock.mockReturnValue({
			delete: remove,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useDeleteProvider("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync({ supplierId: "su1" });

		expect(remove).toHaveBeenCalledWith("/companies/c1/suppliers/su1");
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["providers", "c1"] });
	});

	it("surfaces a 403 as the ApiError the API sent", async () => {
		getApiClientMock.mockReturnValue({
			delete: jest.fn(async () => {
				throw new ApiError("No tenés permiso para esta acción.", 403);
			}),
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useDeleteProvider("c1"), {
			wrapper: wrapperFor(
				new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
			),
		});

		await expect(
			result.current.mutateAsync({ supplierId: "su1" }),
		).rejects.toMatchObject({ status: 403 });
	});

	it("refuses to call the API without an active company", async () => {
		const remove = jest.fn();
		getApiClientMock.mockReturnValue({
			delete: remove,
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useDeleteProvider(undefined), {
			wrapper: wrapperFor(
				new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
			),
		});

		await expect(
			result.current.mutateAsync({ supplierId: "su1" }),
		).rejects.toThrow(/No active company/);
		expect(remove).not.toHaveBeenCalled();
	});
});
