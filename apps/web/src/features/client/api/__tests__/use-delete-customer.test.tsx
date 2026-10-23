import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useDeleteCustomer } from "../use-delete-customer";

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

describe("useDeleteCustomer", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("soft-deletes the customer and refreshes the per-company list", async () => {
		const remove = jest.fn(async () => ({ status: 204, data: undefined }));
		getApiClientMock.mockReturnValue({
			delete: remove,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useDeleteCustomer("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync({ customerId: "cu1" });

		expect(remove).toHaveBeenCalledWith("/companies/c1/customers/cu1");
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["customers", "c1"] });
	});

	it("keeps the customer when the API rejects the deletion", async () => {
		getApiClientMock.mockReturnValue({
			delete: jest.fn(async () => {
				throw new ApiError(
					"Ese cliente ya no existe en esta empresa.",
					404,
					"customer_not_found",
				);
			}),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useDeleteCustomer("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ customerId: "cu1" }),
		).rejects.toMatchObject({ status: 404, code: "customer_not_found" });
		expect(invalidate).not.toHaveBeenCalled();
	});
});
