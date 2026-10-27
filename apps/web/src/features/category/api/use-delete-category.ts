"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { categoriesQueryPrefix } from "./use-categories";

/**
 * Hard-deletes a category (`DELETE /companies/{id}/categories/{categoryId}`).
 *
 * The API answers `204` with no body, so there is nothing to parse: the only
 * result is the refreshed catalogue. Unlike a supplier there is no `deletedAt`,
 * so the row really is gone; this still never removes anything from a cache by
 * hand — the next read simply does not return it. A category that products
 * still reference is rejected with `409 category_in_use`, which the delete
 * dialog shows as the API sent it because the message carries the product count.
 */
export function useDeleteCategory(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<void, unknown, { categoryId: string }>({
		mutationFn: async ({ categoryId }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			await getApiClient({ getAccessToken }).delete(
				`/companies/${companyId}/categories/${categoryId}`,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: categoriesQueryPrefix(companyId),
			});
		},
	});
}
