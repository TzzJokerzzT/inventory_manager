import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { movementsQueryKey, useMovements } from "../use-movements";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function wrapper({ children }: { children: ReactNode }) {
	return <QueryProvider>{children}</QueryProvider>;
}

function movement(overrides: Record<string, unknown> = {}) {
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
		customerId: null,
		customer: null,
		// Added with the purchase-lot feature; a legacy movement has no lot, no
		// written price and no units.
		lotId: null,
		unitPrice: null,
		units: [],
		margin: null,
		...overrides,
	};
}

function mockGet(data: unknown) {
	const get = jest.fn(async () => ({ data }));
	getApiClientMock.mockReturnValue({
		get,
	} as unknown as ReturnType<typeof getApiClient>);
	return get;
}

describe("movementsQueryKey", () => {
	it("scopes every cached read to its company and its filters", () => {
		expect(movementsQueryKey("c1")).toEqual(["movements", "c1", "", "", ""]);
		expect(movementsQueryKey("c1", { productId: "p1" })).toEqual([
			"movements",
			"c1",
			"p1",
			"",
			"",
		]);
		expect(movementsQueryKey("c1", { type: "OUT" })).toEqual([
			"movements",
			"c1",
			"",
			"",
			"OUT",
		]);
		expect(movementsQueryKey("c2", { productId: "p1", type: "IN" })).toEqual([
			"movements",
			"c2",
			"p1",
			"",
			"IN",
		]);
	});

	it("keeps the sales of one customer in their own cache entry", () => {
		expect(movementsQueryKey("c1", { customerId: "cu1", type: "OUT" })).toEqual(
			["movements", "c1", "", "cu1", "OUT"],
		);
		expect(movementsQueryKey("c1", { customerId: "cu2" })).not.toEqual(
			movementsQueryKey("c1", { customerId: "cu1" }),
		);
	});
});

describe("useMovements", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the company's history and parses it at the boundary", async () => {
		const history = [movement(), movement({ id: "m2", type: "OUT" })];
		const get = mockGet(history);

		const { result } = renderHook(() => useMovements("c1"), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		// Sin filtros no se manda un objeto de parámetros vacío.
		expect(get).toHaveBeenCalledWith("/companies/c1/movements", undefined);
		expect(result.current.data).toEqual(history);
	});

	it("sends the filters that are set as query parameters", async () => {
		const get = mockGet([]);

		const { result } = renderHook(
			() => useMovements("c1", { productId: "p1", type: "OUT" }),
			{ wrapper },
		);

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/movements", {
			params: { productId: "p1", type: "OUT" },
		});
	});

	it("sends only the filter that is set", async () => {
		const get = mockGet([]);

		const { result } = renderHook(() => useMovements("c1", { type: "IN" }), {
			wrapper,
		});

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/movements", {
			params: { type: "IN" },
		});
	});

	it("sends the customer filter, alone and combined with the direction", async () => {
		const get = mockGet([]);

		const { result } = renderHook(
			() => useMovements("c1", { customerId: "cu1", type: "OUT" }),
			{ wrapper },
		);

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/movements", {
			params: { customerId: "cu1", type: "OUT" },
		});
	});

	it("does not send an unset customer filter", async () => {
		const get = mockGet([]);

		const { result } = renderHook(
			() => useMovements("c1", { customerId: undefined, type: "OUT" }),
			{ wrapper },
		);

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/movements", {
			params: { type: "OUT" },
		});
	});

	it("does not call the API without an active company", () => {
		const get = mockGet([]);

		const { result } = renderHook(() => useMovements(undefined), {
			wrapper,
		});

		expect(get).not.toHaveBeenCalled();
		expect(result.current.fetchStatus).toBe("idle");
	});

	it("surfaces a data error when the history shape is wrong", async () => {
		mockGet({ movements: [] });

		const { result } = renderHook(() => useMovements("c1"), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});
});
