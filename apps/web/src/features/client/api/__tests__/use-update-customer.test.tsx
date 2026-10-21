import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useUpdateCustomer } from "../use-update-customer";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function customer(overrides: Record<string, unknown> = {}) {
	return {
		id: "cu1",
		companyId: "c1",
		name: "Distribuidora Pérez",
		email: "ventas@perez.com",
		phone: null,
		address: null,
		createdAt: "2026-10-22T12:00:00.000Z",
		updatedAt: "2026-10-23T12:00:00.000Z",
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

describe("useUpdateCustomer", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("patches only the changed fields and returns the updated customer", async () => {
		const updated = customer();
		const patch = jest.fn(async () => ({ data: updated }));
		getApiClientMock.mockReturnValue({
			patch,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useUpdateCustomer("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		const response = await result.current.mutateAsync({
			customerId: "cu1",
			email: null,
		});

		expect(patch).toHaveBeenCalledWith("/companies/c1/customers/cu1", {
			email: null,
		});
		expect(response).toEqual(updated);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["customers", "c1"] });
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: ["customer", "c1", "cu1"],
		});
	});

	it("surfaces the customer_not_found rejection as the ApiError the API sent", async () => {
		getApiClientMock.mockReturnValue({
			patch: jest.fn(async () => {
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

		const { result } = renderHook(() => useUpdateCustomer("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ customerId: "cu1", name: "Otro" }),
		).rejects.toMatchObject({ status: 404, code: "customer_not_found" });
	});
});
