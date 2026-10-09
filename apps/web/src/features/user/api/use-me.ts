"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type MeResponse, parseMeResponse } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * Reads the authenticated user's own identity and memberships (`GET /me`).
 *
 * This is the single source of the `fullName` state: the blocking gate in
 * `/sin-empresas` and the profile page both read it here, and a successful
 * `PATCH /me` invalidates `["me"]` so this hook re-reads instead of keeping a
 * second copy of the name in local state.
 */
export function useMe() {
	return useQuery<MeResponse>({
		queryKey: ["me"],
		queryFn: async () => {
			const response = await getApiClient({ getAccessToken }).get("/me");
			return parseMeResponse(response.data);
		},
	});
}
