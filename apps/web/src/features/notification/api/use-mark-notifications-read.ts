"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { notificationsQueryKey } from "./use-notifications";

/**
 * Marks every unread notification of the caller as read
 * (`POST /me/notifications/read`).
 *
 * It is one action for the whole list, so the UI needs a single button, and it
 * is idempotent: marking again changes nothing. The API answers `204` with no
 * body, so there is nothing to parse at the boundary — the mutation just
 * invalidates `["notifications"]` so the section re-reads and the unread
 * highlight clears.
 */
export function useMarkNotificationsRead() {
	const queryClient = useQueryClient();

	return useMutation<void, unknown, void>({
		mutationFn: async () => {
			await getApiClient({ getAccessToken }).post("/me/notifications/read");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
		},
	});
}
