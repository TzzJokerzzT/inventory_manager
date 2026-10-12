"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type Membership, parseMembership } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { membersQueryKey } from "./use-members";

export type ChangeMemberRoleInput = {
	membershipId: string;
	role: Membership["role"];
};

/**
 * Changes one membership's role (`PATCH /companies/{id}/members/{membershipId}`).
 *
 * The API answers the updated membership; the roster is invalidated so the row
 * re-renders from the server's state instead of a local optimistic copy that
 * could drift after a `last_active_owner` rejection.
 */
export function useChangeMemberRole(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Membership, unknown, ChangeMemberRoleInput>({
		mutationFn: async ({ membershipId, role }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).patch(
				`/companies/${companyId}/members/${membershipId}`,
				{ role },
			);
			return parseMembership(response.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: membersQueryKey(companyId) });
		},
	});
}
