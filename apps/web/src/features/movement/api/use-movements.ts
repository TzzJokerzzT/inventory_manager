"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type MovementsResponse, parseMovements } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * The filters the history endpoint accepts: one product, one customer, one
 * direction.
 */
export type MovementFilters = {
	productId?: string;
	customerId?: string;
	type?: "IN" | "OUT";
};

/**
 * Prefix covering every cached read of one company's history.
 *
 * The registration invalidates this, not a single filter: a new movement changes
 * the history of the company whatever the list is currently narrowing, and
 * React Query matches by prefix, so `["movements", "c1"]` covers
 * `["movements", "c1", "", "", ""]` and `["movements", "c1", "p1", "", "OUT"]`.
 */
export function movementsQueryPrefix(companyId: string | undefined) {
	return ["movements", companyId] as const;
}

/**
 * Shared cache key: the history is per company **and** per filter, so a narrowed
 * read never overwrites the unfiltered one. An absent filter is the empty string,
 * which keeps the key flat and stable instead of nesting `undefined`.
 */
export function movementsQueryKey(
	companyId: string | undefined,
	filters: MovementFilters = {},
) {
	return [
		"movements",
		companyId,
		filters.productId ?? "",
		filters.customerId ?? "",
		filters.type ?? "",
	] as const;
}

/**
 * Reads the company's stock movements (`GET /companies/{id}/movements`), newest
 * first as the API orders them.
 *
 * Disabled while there is no active company: the endpoint needs one and the view
 * shows its own empty state in that case. A filter travels as a query parameter
 * only when it is set — an absent `productId`, `customerId` or `type` must
 * produce the same request and the same cache key as no filter at all, and never
 * `undefined=` in the URL. `customerId` is also a read filter, not a resource:
 * the customer detail view narrows the history with it instead of adding an
 * endpoint. The response is validated at the boundary like every other read.
 */
export function useMovements(
	companyId: string | undefined,
	filters: MovementFilters = {},
) {
	const { productId, customerId, type } = filters;

	return useQuery<MovementsResponse>({
		queryKey: movementsQueryKey(companyId, { productId, customerId, type }),
		enabled: companyId !== undefined,
		queryFn: async () => {
			if (!companyId) {
				return [];
			}
			const params: {
				productId?: string;
				customerId?: string;
				type?: "IN" | "OUT";
			} = {};
			if (productId) {
				params.productId = productId;
			}
			if (customerId) {
				params.customerId = customerId;
			}
			if (type) {
				params.type = type;
			}
			const response = await getApiClient({ getAccessToken }).get(
				`/companies/${companyId}/movements`,
				Object.keys(params).length === 0 ? undefined : { params },
			);
			return parseMovements(response.data);
		},
	});
}
