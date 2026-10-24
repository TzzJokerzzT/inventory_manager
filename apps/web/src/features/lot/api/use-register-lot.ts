"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type CreateLotRequest,
	parseLot,
	type StockLot,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { movementsQueryPrefix } from "@/src/features/movement/api/use-movements";
import { productsQueryPrefix } from "@/src/features/product/api/use-products";

/**
 * Prefix covering every cached read of one company's lots.
 *
 * The contract exposes no lot read yet, so nothing serves it today; it lives
 * here, next to the mutation that invalidates it, so the day a lots query lands
 * it imports this prefix instead of inventing a second key.
 */
export function lotsQueryPrefix(companyId: string | undefined) {
	return ["lots", companyId] as const;
}

/**
 * Registers a purchase lot (`POST /companies/{id}/lots`).
 *
 * One call records the lot, its physical units, the `IN` movement and the stock
 * increment in a single server transaction (L7), so the UI never chains three
 * requests that could leave the stock half-written. `measureTotal` is **not**
 * part of the body: the server derives it from the measures (L6), and sending one
 * answers `400 measure_total_derived`.
 *
 * On success three prefixes are invalidated: the history, because the lot wrote
 * an `IN` movement; the catalogue, whose `stockQuantity` now counts the new
 * units (S8); and the lots of the company. A failed registration invalidates
 * nothing, because nothing was written.
 */
export function useRegisterLot(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<StockLot, unknown, CreateLotRequest>({
		mutationFn: async (body) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).post(
				`/companies/${companyId}/lots`,
				body,
			);
			return parseLot(response.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: movementsQueryPrefix(companyId),
			});
			queryClient.invalidateQueries({
				queryKey: productsQueryPrefix(companyId),
			});
			queryClient.invalidateQueries({ queryKey: lotsQueryPrefix(companyId) });
		},
	});
}
