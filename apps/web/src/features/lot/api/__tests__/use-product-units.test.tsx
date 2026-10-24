import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { productUnitsQueryKey, useProductUnits } from "../use-product-units";

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

function unit(overrides: Record<string, unknown> = {}) {
	return {
		id: "u1",
		code: "R-01",
		measure: "12.500",
		cost: "73750.00",
		status: "AVAILABLE",
		lotId: "lo1",
		receivedAt: "2026-10-23T12:00:00.000Z",
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

describe("productUnitsQueryKey", () => {
	it("scopes the read to the company and the product", () => {
		expect(productUnitsQueryKey("c1", "p1")).toEqual([
			"product-units",
			"c1",
			"p1",
		]);
		expect(productUnitsQueryKey("c1", "p1")).not.toEqual(
			productUnitsQueryKey("c1", "p2"),
		);
		expect(productUnitsQueryKey("c1", "p1")).not.toEqual(
			productUnitsQueryKey("c2", "p1"),
		);
	});
});

describe("useProductUnits", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the available units of the product and parses them at the boundary", async () => {
		const units = [unit(), unit({ id: "u2", code: "R-02" })];
		const get = mockGet(units);

		const { result } = renderHook(() => useProductUnits("c1", "p1"), {
			wrapper,
		});

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		// El estado es explícito: la ventana pide lo que una venta puede tomar.
		expect(get).toHaveBeenCalledWith("/companies/c1/products/p1/units", {
			params: { status: "AVAILABLE" },
		});
		expect(result.current.data).toEqual(units);
	});

	it("fails at the boundary when a unit does not match the contract", async () => {
		mockGet([unit({ measure: 12.5 })]);

		const { result } = renderHook(() => useProductUnits("c1", "p1"), {
			wrapper,
		});

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});

	it("does not read anything without a company or a product", () => {
		const get = mockGet([]);

		renderHook(() => useProductUnits(undefined, "p1"), { wrapper });
		renderHook(() => useProductUnits("c1", undefined), { wrapper });

		expect(get).not.toHaveBeenCalled();
	});

	it("preserves the code and message of a rejected read", async () => {
		const get = jest.fn(async () => {
			throw new ApiError("Ese producto no existe.", 404, "product_not_found");
		});
		getApiClientMock.mockReturnValue({
			get,
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useProductUnits("c1", "p1"), {
			wrapper,
		});

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toMatchObject({
			status: 404,
			code: "product_not_found",
		});
	});
});
