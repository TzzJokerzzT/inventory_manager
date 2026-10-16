"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type PendingInvitationsResponse,
	parsePendingInvitations,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * Shared cache key: pending invitations belong to the caller, not to a company,
 * so one key is enough. `useAcceptInvitations` invalidates the same constant so
 * the section disappears once there is nothing left to accept.
 */
export const pendingInvitationsQueryKey = ["pending-invitations"] as const;

/**
 * Reads the caller's own pending invitations (`GET /me/invitations`).
 *
 * It is the read that turns the accept action from a blind call into a list:
 * the response names the company, the role and the inviter. An empty list is
 * the normal case, not an error, and the response is validated at the boundary
 * like every other response.
 */
export function usePendingInvitations() {
	return useQuery<PendingInvitationsResponse>({
		queryKey: pendingInvitationsQueryKey,
		queryFn: async () => {
			const response = await getApiClient({ getAccessToken }).get(
				"/me/invitations",
			);
			return parsePendingInvitations(response.data);
		},
	});
}
