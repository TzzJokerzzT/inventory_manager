"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type ProductsResponse, parseProducts } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * Prefix covering every cached search of one company.
 *
 * The mutations invalidate this, not a single term: after a write the whole
 * catalogue of the company is stale, whatever the list is currently filtering
 * or whether it is reading the trash. React Query matches by prefix, so
 * `["products", "c1"]` covers `["products", "c1", ""]`,
 * `["products", "c1", "café"]` and `["products", "c1", "", "deleted"]`.
 */
export function productsQueryPrefix(companyId: string | undefined) {
	return ["products", companyId] as const;
}

/** Read modes of the catalogue query. */
export type ProductsQueryOptions = {
	/** Read the trash (only the soft-deleted products) instead of the catalogue. */
	deleted?: boolean;
};

/**
 * Shared cache key: the catalogue is per company, per search term and per mode,
 * so a filtered read never overwrites the unfiltered one and the trash never
 * overwrites the active catalogue.
 *
 * The trash mode is appended only when it is on, which keeps every key the app
 * already used byte-for-byte identical.
 */
export function productsQueryKey(
	companyId: string | undefined,
	search?: string,
	deleted = false,
) {
	return [
		"products",
		companyId,
		search ?? "",
		...(deleted ? (["deleted"] as const) : []),
	] as const;
}

/**
 * Reads the company's products (`GET /companies/{id}/products`).
 *
 * Disabled while there is no active company: the endpoint needs a company id and
 * the list shows its own empty state in that case. `search` travels as a query
 * parameter only when it carries text — an empty or blank term must produce the
 * same request and the same cache key as no search at all. `deleted` asks for
 * the trash: the API answers **only** the soft-deleted products, with the same
 * search and order as the catalogue, and `deleted=true` is sent only when the
 * mode is on, so the default request stays the one existing clients make. The
 * response is validated at the boundary like every other read.
 */
export function useProducts(
	companyId: string | undefined,
	search?: string,
	options?: ProductsQueryOptions,
) {
	const term = search?.trim() ?? "";
	const deleted = options?.deleted === true;

	const params: { search?: string; deleted?: boolean } = {};
	if (term !== "") {
		params.search = term;
	}
	if (deleted) {
		params.deleted = true;
	}

	return useQuery<ProductsResponse>({
		queryKey: productsQueryKey(companyId, term, deleted),
		enabled: companyId !== undefined,
		queryFn: async () => {
			if (!companyId) {
				return [];
			}
			const response = await getApiClient({ getAccessToken }).get(
				`/companies/${companyId}/products`,
				Object.keys(params).length === 0 ? undefined : { params },
			);
			return parseProducts(response.data);
		},
	});
}
