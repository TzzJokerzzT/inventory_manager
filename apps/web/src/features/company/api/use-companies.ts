"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type CompaniesResponse,
	parseCompaniesResponse,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * Reads the companies the authenticated user belongs to.
 *
 * The response is validated at the boundary with the same contract as login:
 * a backend that changes shape fails as a data error instead of exploding in a
 * view. The access token is attached by the client's request interceptor,
 * wired here from the auth session store.
 */
export function useCompanies() {
	return useQuery<CompaniesResponse>({
		queryKey: ["companies"],
		queryFn: async () => {
			const response = await getApiClient({ getAccessToken }).get("/companies");
			return parseCompaniesResponse(response.data);
		},
	});
}
