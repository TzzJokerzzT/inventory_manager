"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type CategoriesResponse, parseCategories } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * Prefix covering every cached read of one company's catalogue.
 *
 * The mutations invalidate this, not a single row: after a write the whole
 * catalogue of the company is stale, and React Query matches by prefix.
 */
export function categoriesQueryPrefix(companyId: string | undefined) {
	return ["categories", companyId] as const;
}

/**
 * Cache key of the catalogue. It is the prefix today — the endpoint takes no
 * search term — and it stays one function so the list and the invalidations
 * cannot drift apart.
 */
export function categoriesQueryKey(companyId: string | undefined) {
	return ["categories", companyId] as const;
}

/**
 * Reads the active company's categories (`GET /companies/{id}/categories`).
 *
 * Any ACTIVE member reads: the catalogue is what a product form needs, not a
 * management screen. The endpoint needs a company id, so the query stays
 * disabled without an active company and the view shows its own "pick a
 * company" state instead of firing a request with an `undefined` id. The
 * response is validated at the boundary like every other read, and the order is
 * the server's (`name`, then `id`), never re-sorted here.
 */
export function useCategories(companyId: string | undefined) {
	return useQuery<CategoriesResponse>({
		queryKey: categoriesQueryKey(companyId),
		enabled: companyId !== undefined,
		queryFn: async () => {
			if (!companyId) {
				return [];
			}
			const response = await getApiClient({ getAccessToken }).get(
				`/companies/${companyId}/categories`,
				undefined,
			);
			return parseCategories(response.data);
		},
	});
}
