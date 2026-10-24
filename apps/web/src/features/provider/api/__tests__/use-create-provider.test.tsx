import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useCreateProvider } from "../use-create-provider";

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

describe("useCreateProvider", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("posts the body and returns the created supplier", async () => {
		const created = supplier();
		const post = jest.fn(async () => ({ data: created }));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useCreateProvider("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		const body = { name: "Plásticos del Sur", contact: null };
		const response = await result.current.mutateAsync(body);

		expect(post).toHaveBeenCalledWith("/companies/c1/suppliers", body);
		expect(response).toEqual(created);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["providers", "c1"] });
	});

	it("fails at the boundary when the API answers the wrong shape", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => ({ data: { id: "su1" } })),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});

		const { result } = renderHook(() => useCreateProvider("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ name: "Plásticos del Sur" }),
		).rejects.toThrow(/respuesta inesperada/);
	});

	it("surfaces the API rejection as the ApiError the API sent", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => {
				throw new ApiError(
					"A supplier with that name already exists in the company",
					409,
					"supplier_name_already_exists",
				);
			}),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});

		const { result } = renderHook(() => useCreateProvider("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ name: "Plásticos del Sur" }),
		).rejects.toMatchObject({
			status: 409,
			code: "supplier_name_already_exists",
		});
	});
});
