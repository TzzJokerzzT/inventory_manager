"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type Product, parseProduct } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/** Shared cache key: one product of one company. */
export function productQueryKey(
	companyId: string | undefined,
	productId: string | undefined,
) {
	return ["product", companyId, productId] as const;
}

/**
 * Reads one product (`GET /companies/{id}/products/{productId}`).
 *
 * The edit view cannot rely on the list being warm: someone can open
 * `/dashboard/products/{id}/edit` directly, from a bookmark or a reload, with an
 * empty cache. Reading the product here makes that navigation work and gives the
 * form its own source of truth; `useUpdateProduct` invalidates this key on
 * success so a stale copy never survives an edit.
 */
export function useProduct(
	companyId: string | undefined,
	productId: string | undefined,
) {
	return useQuery<Product>({
		queryKey: productQueryKey(companyId, productId),
		enabled: companyId !== undefined && productId !== undefined,
		queryFn: async () => {
			if (!companyId || !productId) {
				throw new Error("No active company or product");
			}
			const response = await getApiClient({ getAccessToken }).get(
				`/companies/${companyId}/products/${productId}`,
			);
			return parseProduct(response.data);
		},
	});
}
