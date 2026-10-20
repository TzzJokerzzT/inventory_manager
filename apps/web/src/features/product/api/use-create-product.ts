"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type CreateProductRequest,
	type Product,
	parseProduct,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { productsQueryPrefix } from "./use-products";

/**
 * Creates a product (`POST /companies/{id}/products`).
 *
 * The API answers the created product, so the catalogue is the query
 * invalidated on success: the new row appears from the server's state instead of
 * from a copy the form would have to keep in sync. A duplicate SKU arrives as
 * {@link ApiError} with `code: "sku_already_exists"` and an insufficient role as
 * `insufficient_role`; the form turns both into readable Spanish.
 */
export function useCreateProduct(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Product, unknown, CreateProductRequest>({
		mutationFn: async (input) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).post(
				`/companies/${companyId}/products`,
				input,
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
