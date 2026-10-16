"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type Membership, parseMembership } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { membersQueryKey } from "./use-members";

export type InviteMemberInput = {
	email: string;
	role: Membership["role"];
};

/**
 * Invites an email into the company (`POST /companies/{id}/members`).
 *
 * The API answers the created `INVITED` membership, so the roster is the query
 * invalidated on success: the new row appears without the form owning a copy.
 * `membership_already_exists` and `insufficient_role` arrive as {@link ApiError}
 * with their `code`, and the form turns them into readable Spanish.
 */
export function useInviteMember(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Membership, unknown, InviteMemberInput>({
		mutationFn: async ({ email, role }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).post(
				`/companies/${companyId}/members`,
				{ email, role },
			);
			return parseMembership(response.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: membersQueryKey(companyId) });
		},
	});
}
