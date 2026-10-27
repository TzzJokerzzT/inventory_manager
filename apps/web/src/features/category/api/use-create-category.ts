"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type Category,
	type CreateCategoryRequest,
	parseCategory,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { categoriesQueryPrefix } from "./use-categories";

/**
 * Creates a category (`POST /companies/{id}/categories`).
 *
 * The API answers the created category, so the per-company catalogue is the
 * query invalidated on success: the new row appears from the server's state — in
 * the server's order — instead of from a copy the form would have to keep in
 * sync. The write is guarded by `manage_products` server-side, and both failures
 * worth showing (`403 insufficient_role`, `409 category_name_already_exists`)
 * already carry a message the form can render.
 */
export function useCreateCategory(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Category, unknown, CreateCategoryRequest>({
		mutationFn: async (input) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).post(
				`/companies/${companyId}/categories`,
				input,
			);
			return parseCategory(response.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: categoriesQueryPrefix(companyId),
			});
		},
	});
}
