"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type Membership, parseMembership } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { membersQueryKey } from "./use-members";

/**
 * Leaves the active company (`DELETE /companies/{id}/members/me`).
 *
 * The subject is the caller, so the request names no membership. On success the
 * caller's memberships changed, so `["companies"]` and `["me"]` are invalidated
 * too — the app's view of "which companies am I in" has to drop this one, and
 * the last-active-OWNER rejection comes back as an {@link ApiError} the section
 * reports instead of hiding.
 */
export function useLeaveCompany(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Membership, unknown, void>({
		mutationFn: async () => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).delete(
				`/companies/${companyId}/members/me`,
			);
			return parseMembership(response.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: membersQueryKey(companyId) });
			queryClient.invalidateQueries({ queryKey: ["companies"] });
			queryClient.invalidateQueries({ queryKey: ["me"] });
		},
	});
}
