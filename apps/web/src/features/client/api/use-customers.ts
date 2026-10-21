"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type CustomersResponse, parseCustomers } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * Prefix covering every cached search of one company.
 *
 * The mutations invalidate this, not a single term: after a write the whole
 * customer list of the company is stale, whatever the list is currently
 * filtering. React Query matches by prefix, so `["customers", "c1"]` covers
 * `["customers", "c1", ""]` and `["customers", "c1", "perez"]`.
 */
export function customersQueryPrefix(companyId: string | undefined) {
	return ["customers", companyId] as const;
}

/**
 * Shared cache key: the list is per company **and** per search term, so a
 * filtered read never overwrites the unfiltered one.
 */
export function customersQueryKey(
	companyId: string | undefined,
	search?: string,
) {
	return ["customers", companyId, search ?? ""] as const;
}

/**
 * Reads the active company's customers (`GET /companies/{id}/customers`).
 *
 * Disabled while there is no active company: the endpoint needs a company id and
 * the view shows its own empty state in that case. `search` travels as a query
 * parameter only when it carries text — an empty or blank term must produce the
 * same request and the same cache key as no search at all, which is also what
 * the API expects. The response is validated at the boundary like every other
 * read, and the order is the server's (`name`, then `id`), never re-sorted here.
 */
export function useCustomers(companyId: string | undefined, search?: string) {
	const term = search?.trim() ?? "";

	return useQuery<CustomersResponse>({
		queryKey: customersQueryKey(companyId, term),
		enabled: companyId !== undefined,
		queryFn: async () => {
			if (!companyId) {
				return [];
			}
			const response = await getApiClient({ getAccessToken }).get(
				`/companies/${companyId}/customers`,
				term === "" ? undefined : { params: { search: term } },
			);
			return parseCustomers(response.data);
		},
	});
}
