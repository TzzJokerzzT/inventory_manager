"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type Category,
	parseCategory,
	type UpdateCategoryRequest,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { categoriesQueryPrefix } from "./use-categories";

/** One rename: the category to patch plus the fields that actually change. */
export type UpdateCategoryInput = UpdateCategoryRequest & {
	categoryId: string;
};

/**
 * Renames a category (`PATCH /companies/{id}/categories/{categoryId}`).
 *
 * `categoryId` is the target of the request, never part of the body: the body is
 * the partial update the contract describes, where an absent `name` keeps its
 * value. There is no per-category read in the contract, so the catalogue key is
 * the only thing to invalidate — and it is the one the list and the form both
 * show.
 */
export function useUpdateCategory(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Category, unknown, UpdateCategoryInput>({
		mutationFn: async ({ categoryId, ...body }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).patch(
				`/companies/${companyId}/categories/${categoryId}`,
				body,
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
