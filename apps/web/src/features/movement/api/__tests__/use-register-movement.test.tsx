import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useRegisterMovement } from "../use-register-movement";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function registered(overrides: Record<string, unknown> = {}) {
	return {
		id: "m1",
		companyId: "c1",
		productId: "p1",
		type: "IN",
		quantity: 10,
		reason: "Compra a proveedor",
		createdAt: "2026-10-21T12:00:00.000Z",
		product: { id: "p1", name: "Café molido 500g", sku: "CAF-500" },
		actor: { id: "user-1", fullName: "Ana", email: "ana@empresa.com" },
		stockQuantity: 10,
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
	return new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
}

describe("useRegisterMovement", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("posts the body and returns the movement with the resulting stock", async () => {
		const response = registered();
		const post = jest.fn(async () => ({ data: response }));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();

		const { result } = renderHook(() => useRegisterMovement("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		const created = await result.current.mutateAsync({
			productId: "p1",
			type: "IN",
			quantity: 10,
			reason: "Compra a proveedor",
		});

		expect(post).toHaveBeenCalledWith("/companies/c1/movements", {
			productId: "p1",
			type: "IN",
			quantity: 10,
			reason: "Compra a proveedor",
		});
		expect(created).toEqual(response);
		expect(created.stockQuantity).toBe(10);
	});

	it("invalidates the history and the catalogue of the company", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => ({ data: registered() })),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useRegisterMovement("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync({
			productId: "p1",
			type: "OUT",
			quantity: 2,
		});

		// El prefijo del historial: cualquier filtro cacheado queda viejo.
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["movements", "c1"] });
		// El del catálogo: el stock que se muestra en productos cambia sin recargar.
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["products", "c1"] });
	});

	it("preserves the insufficient_stock code and message the API sent", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => {
				throw new ApiError(
					"No hay stock suficiente: disponible 3.",
					409,
					"insufficient_stock",
				);
			}),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();

		const { result } = renderHook(() => useRegisterMovement("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ productId: "p1", type: "OUT", quantity: 5 }),
		).rejects.toMatchObject({
			status: 409,
			code: "insufficient_stock",
			message: "No hay stock suficiente: disponible 3.",
		});
	});

	it("does not invalidate anything when the registration fails", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => {
				throw new ApiError("Ese producto no existe.", 404, "product_not_found");
			}),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useRegisterMovement("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ productId: "p1", type: "IN", quantity: 1 }),
		).rejects.toMatchObject({ status: 404 });

		expect(invalidate).not.toHaveBeenCalled();
	});

	it("fails at the boundary when the response has no resulting stock", async () => {
		const { stockQuantity: _stock, ...withoutStock } = registered();
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => ({ data: withoutStock })),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();

		const { result } = renderHook(() => useRegisterMovement("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(
			result.current.mutateAsync({ productId: "p1", type: "IN", quantity: 1 }),
		).rejects.toThrow(/respuesta inesperada/);
	});
});
