"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { providersQueryPrefix } from "./use-providers";

/**
 * Soft-deletes a supplier (`DELETE /companies/{id}/suppliers/{supplierId}`).
 *
 * The API answers `204` with no body, so there is nothing to parse: the only
 * result is the refreshed roster. The row is kept server-side with its
 * `deletedAt` stamped — which also keeps the name reserved — so this never
 * removes anything from a cache by hand: the next read simply does not return
 * it.
 */
export function useDeleteProvider(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<void, unknown, { supplierId: string }>({
		mutationFn: async ({ supplierId }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			await getApiClient({ getAccessToken }).delete(
				`/companies/${companyId}/suppliers/${supplierId}`,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: providersQueryPrefix(companyId),
			});
		},
	});
}
