import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useRegisterLot } from "../use-register-lot";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function unit(overrides: Record<string, unknown> = {}) {
	return {
		id: "lu1",
		code: "R-01",
		measure: "12.500",
		cost: "73750.00",
		status: "AVAILABLE",
		...overrides,
	};
}

function created(overrides: Record<string, unknown> = {}) {
	return {
		id: "lo1",
		companyId: "c1",
		productId: "p1",
		supplierId: "su1",
		receivedAt: "2026-10-23T12:00:00.000Z",
		measureTotal: "25.000",
		costPerMeasure: "5900.00",
		unitCount: 2,
		note: null,
		createdAt: "2026-10-23T12:00:00.000Z",
		units: [unit(), unit({ id: "lu2", code: "R-02" })],
		...overrides,
	};
}

const BODY = {
	productId: "p1",
	supplierId: "su1",
	costPerMeasure: "5900.00",
	measures: [12.5, 12.5],
};

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

describe("useRegisterLot", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("posts the purchase to the lots endpoint and returns the created lot", async () => {
		const response = created();
		const post = jest.fn(async () => ({ data: response }));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();

		const { result } = renderHook(() => useRegisterLot("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		const lot = await result.current.mutateAsync(BODY);

		expect(post).toHaveBeenCalledWith("/companies/c1/lots", BODY);
		expect(lot).toEqual(response);
	});

	it("never sends the measured total: the server derives it from the units", async () => {
		const post = jest.fn(async () => ({ data: created() }));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();

		const { result } = renderHook(() => useRegisterLot("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync(BODY);

		const [, body] = post.mock.calls[0] as unknown as [string, object];
		expect("measureTotal" in body).toBe(false);
	});

	it("invalidates the history, the catalogue and the lots of the company", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => ({ data: created() })),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useRegisterLot("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await result.current.mutateAsync(BODY);

		// El lote crea el movimiento IN en la misma transacción (L7).
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["movements", "c1"] });
		// Y suma unidades al stock del producto.
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["products", "c1"] });
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["lots", "c1"] });
	});

	it("preserves the code and message of a rejected purchase", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => {
				throw new ApiError(
					"Ese proveedor no existe en esta empresa.",
					404,
					"supplier_not_found",
				);
			}),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();

		const { result } = renderHook(() => useRegisterLot("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(result.current.mutateAsync(BODY)).rejects.toMatchObject({
			status: 404,
			code: "supplier_not_found",
		});
	});

	it("does not invalidate anything when the purchase fails", async () => {
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => {
				throw new ApiError("Sin permiso.", 403, "insufficient_role");
			}),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useRegisterLot("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(result.current.mutateAsync(BODY)).rejects.toMatchObject({
			status: 403,
		});

		expect(invalidate).not.toHaveBeenCalled();
	});

	it("fails at the boundary when the response has no unit list", async () => {
		const { units: _units, ...withoutUnits } = created();
		getApiClientMock.mockReturnValue({
			post: jest.fn(async () => ({ data: withoutUnits })),
		} as unknown as ReturnType<typeof getApiClient>);
		const queryClient = newQueryClient();

		const { result } = renderHook(() => useRegisterLot("c1"), {
			wrapper: wrapperFor(queryClient),
		});

		await expect(result.current.mutateAsync(BODY)).rejects.toThrow(
			/respuesta inesperada/,
		);
	});
});
