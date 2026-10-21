import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useCreateCustomer } from "../use-create-customer";

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
		email: null,
		phone: null,
		address: null,
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

describe("useCreateCustomer", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("posts the body and returns the created customer", async () => {
		const created = customer();
		const post = jest.fn(async () => ({ data: created }));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useCreateCustomer("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		const body = {
			name: "Distribuidora Pérez",
			email: "ventas@perez.com",
			phone: null,
			address: null,
		};
		const response = await result.current.mutateAsync(body);

		expect(post).toHaveBeenCalledWith("/companies/c1/customers", body);
		expect(response).toEqual(created);
		// The per-company prefix, so every cached search refreshes.
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["customers", "c1"] });
	});

	it("fails at the boundary when the API answers the wrong shape", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => ({ data: { id: "cu1" } })),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});

		const { result } = renderHook(() => useCreateCustomer("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ name: "Distribuidora Pérez" }),
		).rejects.toThrow(/respuesta inesperada/);
	});

	it("surfaces the API rejection as the ApiError the API sent", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => {
				throw new ApiError(
					"No tenés acceso a esta empresa.",
					403,
					"company_access_forbidden",
				);
			}),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});

		const { result } = renderHook(() => useCreateCustomer("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ name: "Distribuidora Pérez" }),
		).rejects.toMatchObject({
			status: 403,
			code: "company_access_forbidden",
		});
	});
});
