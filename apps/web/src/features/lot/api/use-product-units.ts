"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type ProductUnitsResponse,
	parseProductUnits,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/**
 * Prefix covering every cached read of one company's product units.
 *
 * The sale invalidates one product's list through the exact key, not the whole
 * prefix: selling a product says nothing about the units of another one.
 */
export function productUnitsQueryPrefix(companyId: string | undefined) {
	return ["product-units", companyId] as const;
}

/**
 * Shared cache key: the units are per company **and** per product, so the units
 * of one product never overwrite another's. A missing product collapses to the
 * empty string, which keeps the key flat and stable instead of nesting
 * `undefined`.
 */
export function productUnitsQueryKey(
	companyId: string | undefined,
	productId: string | undefined,
) {
	return [...productUnitsQueryPrefix(companyId), productId ?? ""] as const;
}

/**
 * Reads the available units of one product (`GET /products/{id}/units`).
 *
 * It is what lets a sale offer **which** units leave instead of only how many
 * (L23): each unit carries its own measure and cost, so the person can see what
 * is going out. The read asks for `status=AVAILABLE` explicitly — the default
 * is the same, and saying it keeps the sale's intent in the request.
 *
 * Disabled without a company or a product: the endpoint needs both, and the
 * form asks for the units of whatever product is selected, which is nothing at
 * first. The response is validated at the boundary like every other read.
 */
export function useProductUnits(
	companyId: string | undefined,
	productId: string | undefined,
) {
	return useQuery<ProductUnitsResponse>({
		queryKey: productUnitsQueryKey(companyId, productId),
		enabled: companyId !== undefined && productId !== undefined,
		queryFn: async () => {
			if (!companyId || !productId) {
				return [];
			}
			const response = await getApiClient({ getAccessToken }).get(
				`/companies/${companyId}/products/${productId}/units`,
				{ params: { status: "AVAILABLE" } },
			);
			return parseProductUnits(response.data);
		},
	});
}
