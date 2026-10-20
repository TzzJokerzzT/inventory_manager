"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type Product,
	parseProduct,
	type UpdateProductRequest,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { productQueryKey } from "./use-product";
import { productsQueryPrefix } from "./use-products";

/** One update: the product to patch plus the fields that actually change. */
export type UpdateProductInput = UpdateProductRequest & { productId: string };

/**
 * Edits a product (`PATCH /companies/{id}/products/{productId}`).
 *
 * `productId` is the target of the request, never part of the body: the body is
 * the partial update the contract describes, where an absent field keeps its
 * value and `null` clears `description` or `photoUrl`. On success both the
 * catalogue (every cached search of the company) and the product's own detail
 * key are invalidated, so no view keeps a stale copy.
 */
export function useUpdateProduct(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Product, unknown, UpdateProductInput>({
		mutationFn: async ({ productId, ...body }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).patch(
				`/companies/${companyId}/products/${productId}`,
				body,
			);
			return parseProduct(response.data);
		},
		onSuccess: (_product, { productId }) => {
			queryClient.invalidateQueries({
				queryKey: productsQueryPrefix(companyId),
			});
			queryClient.invalidateQueries({
				queryKey: productQueryKey(companyId, productId),
			});
		},
	});
}
