"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type MembershipsResponse,
	parseMembershipsResponse,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { pendingInvitationsQueryKey } from "./use-pending-invitations";

/**
 * Accepts every pending invitation for the caller (`POST /me/invitations/accept`).
 *
 * `GET /me` only returns `ACTIVE` memberships, so the client cannot see a
 * pending invitation: the pending list comes from `GET /me/invitations`.
 * It is idempotent and an empty list is the normal "nothing pending" answer,
 * not an error.
 *
 * On success `["companies"]`, `["me"]` and `["pending-invitations"]` are
 * invalidated: the acceptance rewrites both the company list and `/me`, and it
 * empties the pending list, which is what makes the panel section disappear.
 * The `/sin-empresas` redirect reacts to the refreshed company list without
 * this hook owning any navigation of its own.
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
			queryClient.invalidateQueries({ queryKey: pendingInvitationsQueryKey });
		},
	});
}
