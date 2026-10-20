"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { productsQueryPrefix } from "./use-products";

/**
 * Soft-deletes a product (`DELETE /companies/{id}/products/{productId}`).
 *
 * The API answers `204` with no body, so there is nothing to parse: the only
 * result is the refreshed catalogue. The row is kept server-side with
 * `deletedAt` stamped, which is why this never removes anything from a cache by
 * hand — the next read simply does not return it.
 */
export function useDeleteProduct(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<void, unknown, { productId: string }>({
		mutationFn: async ({ productId }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			await getApiClient({ getAccessToken }).delete(
				`/companies/${companyId}/products/${productId}`,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: productsQueryPrefix(companyId),
			});
		},
	});
}
