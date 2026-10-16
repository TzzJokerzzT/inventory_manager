"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type Membership, parseMembership } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { membersQueryKey } from "./use-members";

/**
 * Revokes someone else's membership (`DELETE /companies/{id}/members/{membershipId}`).
 *
 * The API answers the revoked membership (`status: REVOKED`) and the roster is
 * invalidated so the row disappears. An OWNER that would be left unreachable —
 * `last_active_owner` — comes back as an {@link ApiError} the table reports.
 */
export function useRevokeMember(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Membership, unknown, { membershipId: string }>({
		mutationFn: async ({ membershipId }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).delete(
				`/companies/${companyId}/members/${membershipId}`,
			);
			return parseMembership(response.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: membersQueryKey(companyId) });
		},
	});
}
