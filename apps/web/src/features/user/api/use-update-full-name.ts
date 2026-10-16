"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type MeResponse, parseMeResponse } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * Sets the authenticated user's display name (`PATCH /me` with `{ fullName }`).
 *
 * The API accepts `null` to clear the name, but this UI never sends it: the
 * form requires a non-empty trimmed value, so `fullName` is a plain `string`.
 * On success `["me"]` is invalidated — the same query the blocking gate reads —
 * so the gate reacts to the new name without duplicating state.
 */
export function useUpdateFullName() {
	const queryClient = useQueryClient();

	return useMutation<MeResponse, unknown, { fullName: string }>({
		mutationFn: async ({ fullName }) => {
			const response = await getApiClient({ getAccessToken }).patch("/me", {
				fullName,
			});
			return parseMeResponse(response.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["me"] });
		},
	});
}
