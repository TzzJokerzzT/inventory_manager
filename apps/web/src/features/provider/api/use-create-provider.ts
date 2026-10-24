"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type CreateSupplierRequest,
	parseSupplier,
	type Supplier,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { providersQueryPrefix } from "./use-providers";

/**
 * Creates a supplier (`POST /companies/{id}/suppliers`).
 *
 * The API answers the created supplier, so the per-company roster is the query
 * invalidated on success: the new row appears from the server's state — in the
 * server's order — instead of from a copy the form would have to keep in sync.
 * The write is guarded by `manage_products` server-side, and both failures worth
 * translating (`403 insufficient_role`, `409 supplier_name_already_exists`)
 * already carry a message the form can show as-is.
 */
export function useCreateProvider(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Supplier, unknown, CreateSupplierRequest>({
		mutationFn: async (input) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).post(
				`/companies/${companyId}/suppliers`,
				input,
			);
			return parseSupplier(response.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: providersQueryPrefix(companyId),
			});
		},
	});
}
