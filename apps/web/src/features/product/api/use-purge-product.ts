"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { productsQueryPrefix } from "./use-products";

/**
 * Permanently deletes a soft-deleted product
 * (`DELETE /companies/{id}/products/{productId}/permanent`).
 *
 * It is the second half of the trash — a product can be restored or purged — and
 * it is irreversible: the row leaves the database, so it is OWNER-only and the
 * API rejects it with `403 insufficient_role` for anyone else. The API answers
 * `204` with no body, so there is nothing to parse; the products prefix is
 * invalidated because the purged row disappears from the trash and from every
 * cached search of the company.
 *
 * The failures travel as `ApiError`, which the confirmation dialog shows as-is:
 * `409 product_has_movements` when the ledger still points at the product (the
 * movement history is the audit trail and is never deleted), `409
 * product_not_deleted` when the product is not in the trash, and `404
 * product_not_found` when it does not belong to the company.
 */
export function usePurgeProduct(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<void, unknown, { productId: string }>({
		mutationFn: async ({ productId }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			await getApiClient({ getAccessToken }).delete(
				`/companies/${companyId}/products/${productId}/permanent`,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: productsQueryPrefix(companyId),
			});
		},
	});
}
