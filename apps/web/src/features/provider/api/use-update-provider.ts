"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	parseSupplier,
	type Supplier,
	type UpdateSupplierRequest,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { providersQueryPrefix } from "./use-providers";

/** One update: the supplier to patch plus the fields that actually change. */
export type UpdateProviderInput = UpdateSupplierRequest & {
	supplierId: string;
};

/**
 * Edits a supplier (`PATCH /companies/{id}/suppliers/{supplierId}`).
 *
 * `supplierId` is the target of the request, never part of the body: the body is
 * the partial update the contract describes, where an absent field keeps its
 * value and `null` clears `contact`. There is no per-supplier read in the
 * contract, so the roster key is the only thing to invalidate — and it is the
 * one the roster and the form both show.
 */
export function useUpdateProvider(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Supplier, unknown, UpdateProviderInput>({
		mutationFn: async ({ supplierId, ...body }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).patch(
				`/companies/${companyId}/suppliers/${supplierId}`,
				body,
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
