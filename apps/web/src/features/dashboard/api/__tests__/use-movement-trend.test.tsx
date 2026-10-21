import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { movementTrendQueryKey, useMovementTrend } from "../use-movement-trend";

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

function trend(overrides: Record<string, unknown> = {}) {
	return {
		days: 30,
		series: [
			{ date: "2026-10-20", entries: 0, exits: 0 },
			{ date: "2026-10-21", entries: 3, exits: 1 },
		],
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

describe("movementTrendQueryKey", () => {
	it("scopes every cached window to its company and its day count", () => {
		expect(movementTrendQueryKey("c1", 30)).toEqual([
			"movement-trend",
			"c1",
			30,
		]);
		expect(movementTrendQueryKey("c1", 7)).toEqual(["movement-trend", "c1", 7]);
		expect(movementTrendQueryKey("c2", 30)).toEqual([
			"movement-trend",
			"c2",
			30,
		]);
	});
});

describe("useMovementTrend", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the report of the last 30 days by default and parses it", async () => {
		const report = trend();
		const get = mockGet(report);

		const { result } = renderHook(() => useMovementTrend("c1"), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/reports/movements", {
			params: { days: 30 },
		});
		expect(result.current.data).toEqual(report);
	});

	it("asks for the window it was given", async () => {
		const get = mockGet(trend({ days: 7 }));

		const { result } = renderHook(() => useMovementTrend("c1", 7), {
			wrapper,
		});

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/reports/movements", {
			params: { days: 7 },
		});
	});

	it("does not call the API without an active company", () => {
		const get = mockGet(trend());

		const { result } = renderHook(() => useMovementTrend(undefined), {
			wrapper,
		});

		expect(get).not.toHaveBeenCalled();
		expect(result.current.fetchStatus).toBe("idle");
	});

	it("surfaces a data error when the report shape is wrong", async () => {
		mockGet({
			days: 30,
			series: [{ date: "21-10-2026", entries: 1, exits: 0 }],
		});

		const { result } = renderHook(() => useMovementTrend("c1"), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});
});
