"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type MembershipsResponse,
	parseMembershipsResponse,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/** Shared cache key: the roster is per company, never global. */
export function membersQueryKey(companyId: string | undefined) {
	return ["members", companyId] as const;
}

/**
 * Reads the active company's membership roster (`GET /companies/{id}/members`).
 *
 * Disabled while there is no active company: the endpoint needs a company id
 * and the section shows its own empty state in that case. The response carries
 * both `ACTIVE` and `INVITED` rows (never `REVOKED`) and is validated at the
 * boundary like every other response.
 */
export function useMembers(companyId: string | undefined) {
	return useQuery<MembershipsResponse>({
		queryKey: membersQueryKey(companyId),
		enabled: companyId !== undefined,
		queryFn: async () => {
			if (!companyId) {
				return [];
			}
			const response = await getApiClient({ getAccessToken }).get(
				`/companies/${companyId}/members`,
			);
			return parseMembershipsResponse(response.data);
		},
	});
}
