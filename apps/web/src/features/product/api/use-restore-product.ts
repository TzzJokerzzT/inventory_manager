"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type Product, parseProduct } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { productsQueryPrefix } from "./use-products";

/**
 * Restores a soft-deleted product (`POST /companies/{id}/products/{productId}/restore`).
 *
 * The API clears `deletedAt` and answers `200` with the product active again,
 * with its SKU and its movement history untouched. Because the product leaves
 * the trash and enters the catalogue, the products prefix is invalidated: it
 * covers both lists of the company, so the restored row disappears from the
 * trash and reappears in the catalogue without a manual cache edit.
 *
 * The failures are the server's to explain and travel as `ApiError`:
 * `409 product_not_deleted` when the product was not in the trash (the trash is
 * a state, not a flag), `404 product_not_found` when it belongs to another
 * company, and `403 insufficient_role` when the caller cannot manage products.
 */
export function useRestoreProduct(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Product, unknown, { productId: string }>({
		mutationFn: async ({ productId }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).post(
				`/companies/${companyId}/products/${productId}/restore`,
			);
			return parseProduct(response.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: productsQueryPrefix(companyId),
			});
		},
	});
}
