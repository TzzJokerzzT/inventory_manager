import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import {
	providersQueryKey,
	providersQueryPrefix,
	useProviders,
} from "../use-providers";

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

function supplier(overrides: Record<string, unknown> = {}) {
	return {
		id: "su1",
		companyId: "c1",
		name: "Plásticos del Sur",
		contact: null,
		createdAt: "2026-10-22T12:00:00.000Z",
		updatedAt: "2026-10-22T12:00:00.000Z",
		lastLot: null,
		...overrides,
	};
}

function lastLot(overrides: Record<string, unknown> = {}) {
	return {
		id: "lot1",
		productId: "p1",
		productName: "Rollo de polietileno",
		costPerMeasure: "5900.00",
		measureUnit: "KILOGRAM",
		receivedAt: "2026-10-22T12:00:00.000Z",
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

describe("providersQueryPrefix", () => {
	it("scopes every cached read to its company", () => {
		expect(providersQueryPrefix("c1")).toEqual(["providers", "c1"]);
		expect(providersQueryPrefix("c2")).toEqual(["providers", "c2"]);
		// The prefix is what the mutations invalidate, so it must cover the key
		// the list actually uses.
		expect(providersQueryKey("c1")).toEqual(["providers", "c1"]);
	});
});

describe("useProviders", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the active company's roster and parses it at the boundary", async () => {
		const list = [supplier({ lastLot: lastLot() })];
		const get = mockGet(list);

		const { result } = renderHook(() => useProviders("c1"), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/suppliers", undefined);
		expect(result.current.data).toEqual(list);
	});

	it("does not call the API without an active company", () => {
		const get = mockGet([]);

		const { result } = renderHook(() => useProviders(undefined), { wrapper });

		expect(get).not.toHaveBeenCalled();
		expect(result.current.fetchStatus).toBe("idle");
	});

	it("surfaces a data error when the list shape is wrong", async () => {
		mockGet({ suppliers: [] });

		const { result } = renderHook(() => useProviders("c1"), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});
});
