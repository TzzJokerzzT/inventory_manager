"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type MovementTrendResponse,
	parseMovementTrend,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/** The window the dashboard draws when it does not ask for another one. */
export const MOVEMENT_TREND_DEFAULT_DAYS = 30;

/**
 * Shared cache key: the report is per company **and** per window, so a 7-day read
 * never overwrites the 30-day one the dashboard already has.
 */
export function movementTrendQueryKey(
	companyId: string | undefined,
	days: number,
) {
	return ["movement-trend", companyId, days] as const;
}

/**
 * Reads the movement trend report (`GET /companies/{id}/reports/movements`).
 *
 * The server aggregates it: one point per UTC day, oldest first, with the days
 * without movements already zero-filled, so the chart draws what it receives and
 * never re-sorts or re-fills the series. `days` is the window the user asked for
 * (the server validates it against `1..90`), so it travels as a query parameter
 * and is part of the cache key.
 *
 * Disabled while there is no active company: the endpoint needs a company id and
 * the chart shows its own empty state in that case. The response is validated at
 * the boundary like every other read.
 */
export function useMovementTrend(
	companyId: string | undefined,
	days: number = MOVEMENT_TREND_DEFAULT_DAYS,
) {
	return useQuery<MovementTrendResponse>({
		queryKey: movementTrendQueryKey(companyId, days),
		enabled: companyId !== undefined,
		queryFn: async () => {
			if (!companyId) {
				return { days, series: [] };
			}
			const response = await getApiClient({ getAccessToken }).get(
				`/companies/${companyId}/reports/movements`,
				{ params: { days } },
			);
			return parseMovementTrend(response.data);
		},
	});
}
