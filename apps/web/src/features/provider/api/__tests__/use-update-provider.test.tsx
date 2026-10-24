import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useUpdateProvider } from "../use-update-provider";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function supplier(overrides: Record<string, unknown> = {}) {
	return {
		id: "su1",
		companyId: "c1",
		name: "Plásticos del Sur",
		contact: null,
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

describe("useUpdateProvider", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("patches the supplier with the changed fields only", async () => {
		const updated = supplier({ name: "Plásticos del Norte" });
		const patch = jest.fn(async () => ({ data: updated }));
		getApiClientMock.mockReturnValue({
			patch,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useUpdateProvider("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		const response = await result.current.mutateAsync({
			supplierId: "su1",
			name: "Plásticos del Norte",
			contact: null,
		});

		// `supplierId` is the target of the request, never part of the body.
		expect(patch).toHaveBeenCalledWith("/companies/c1/suppliers/su1", {
			name: "Plásticos del Norte",
			contact: null,
		});
		expect(response).toEqual(updated);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["providers", "c1"] });
	});

	it("surfaces a 404 as the ApiError the API sent", async () => {
		getApiClientMock.mockReturnValue({
			patch: jest.fn(async () => {
				throw new ApiError("Supplier not found", 404, "supplier_not_found");
			}),
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useUpdateProvider("c1"), {
			wrapper: wrapperFor(newQueryClient()),
		});

		await expect(
			result.current.mutateAsync({ supplierId: "su1", name: "X" }),
		).rejects.toMatchObject({ status: 404, code: "supplier_not_found" });
	});
});
