"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type ProductsResponse, parseProducts } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * Prefix covering every cached search of one company.
 *
 * The mutations invalidate this, not a single term: after a write the whole
 * catalogue of the company is stale, whatever the list is currently filtering.
 * React Query matches by prefix, so `["products", "c1"]` covers `["products",
 * "c1", ""]` and `["products", "c1", "café"]`.
 */
export function productsQueryPrefix(companyId: string | undefined) {
	return ["products", companyId] as const;
}

/**
 * Shared cache key: the catalogue is per company **and** per search term, so a
 * filtered read never overwrites the unfiltered one.
 */
export function productsQueryKey(
	companyId: string | undefined,
	search?: string,
) {
	return ["products", companyId, search ?? ""] as const;
}

/**
 * Reads the active company's catalogue (`GET /companies/{id}/products`).
 *
 * Disabled while there is no active company: the endpoint needs a company id and
 * the list shows its own empty state in that case. `search` travels as a query
 * parameter only when it carries text — an empty or blank term must produce the
 * same request and the same cache key as no search at all. The response is
 * validated at the boundary like every other read.
 */
export function useProducts(companyId: string | undefined, search?: string) {
	const term = search?.trim() ?? "";

	return useQuery<ProductsResponse>({
		queryKey: productsQueryKey(companyId, term),
		enabled: companyId !== undefined,
		queryFn: async () => {
			if (!companyId) {
				return [];
			}
			const response = await getApiClient({ getAccessToken }).get(
				`/companies/${companyId}/products`,
				term === "" ? undefined : { params: { search: term } },
			);
			return parseProducts(response.data);
		},
	});
}
