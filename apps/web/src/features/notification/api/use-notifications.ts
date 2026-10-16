"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type NotificationsResponse,
	parseNotifications,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * Shared cache key: notifications belong to the caller, not to a company, so
 * one key is enough. `useMarkNotificationsRead` invalidates the same constant
 * so the unread highlight clears after the mark-all action.
 */
export const notificationsQueryKey = ["notifications"] as const;

/**
 * Reads the caller's own notification events (`GET /me/notifications`).
 *
 * The API answers them newest first and an empty list is the normal case, not
 * an error. Focus refetch is opted back in: the provider turns it off
 * globally, but a notification is news the caller only sees when they return
 * to the tab, so this is the one read that wants it. There is still no
 * polling — a timer would fetch while nothing changed.
 */
export function useNotifications() {
	return useQuery<NotificationsResponse>({
		queryKey: notificationsQueryKey,
		queryFn: async () => {
			const response = await getApiClient({ getAccessToken }).get(
				"/me/notifications",
			);
			return parseNotifications(response.data);
		},
		refetchOnWindowFocus: true,
	});
}
