"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { customersQueryPrefix } from "./use-customers";

/**
 * Soft-deletes a customer (`DELETE /companies/{id}/customers/{customerId}`).
 *
 * The API answers `204` with no body, so there is nothing to parse: the only
 * result is the refreshed list. The row is kept server-side with `deletedAt`
 * stamped, which is why this never removes anything from a cache by hand — the
 * next read simply does not return it.
 */
export function useDeleteCustomer(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<void, unknown, { customerId: string }>({
		mutationFn: async ({ customerId }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			await getApiClient({ getAccessToken }).delete(
				`/companies/${companyId}/customers/${customerId}`,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: customersQueryPrefix(companyId),
			});
		},
	});
}
