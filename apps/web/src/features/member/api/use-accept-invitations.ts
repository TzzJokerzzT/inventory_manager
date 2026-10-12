"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type MembershipsResponse,
	parseMembershipsResponse,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * Accepts every pending invitation for the caller (`POST /me/invitations/accept`).
 *
 * `GET /me` only returns `ACTIVE` memberships, so the client cannot see a
 * pending invitation: the only way to find out is to call this endpoint and
 * check whether it answered anything. It is idempotent and an empty list is the
 * normal "nothing pending" answer, not an error.
 *
 * On success `["companies"]` and `["me"]` are invalidated: the acceptance
 * rewrites both, and the `/sin-empresas` redirect reacts to the refreshed
 * company list without this hook owning any navigation of its own.
 */
export function useAcceptInvitations() {
	const queryClient = useQueryClient();

	return useMutation<MembershipsResponse, unknown, void>({
		mutationFn: async () => {
			const response = await getApiClient({ getAccessToken }).post(
				"/me/invitations/accept",
			);
			return parseMembershipsResponse(response.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["companies"] });
			queryClient.invalidateQueries({ queryKey: ["me"] });
		},
	});
}
