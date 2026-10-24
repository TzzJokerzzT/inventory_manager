"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	parseRegisterMovementResponse,
	type RegisterMovementRequest,
	type RegisterMovementResponse,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { productUnitsQueryKey } from "@/src/features/lot/api/use-product-units";
import { productsQueryPrefix } from "@/src/features/product/api/use-products";
import { movementsQueryPrefix } from "./use-movements";

/**
 * Registers an entry or an exit (`POST /companies/{id}/movements`).
 *
 * The API answers the recorded movement **and the stock left after it**, in one
 * transaction (MOV-04), so the UI shows the server's number instead of computing
 * `previous + quantity` from a cache it cannot trust.
 *
 * On success two prefixes are invalidated: the company's history, so the new row
 * appears from the server's state, and the product catalogue, whose
 * `stockQuantity` just changed — that is what makes the stock shown elsewhere
 * update without a reload (S8). A failed registration invalidates nothing,
 * because the stock did not move.
 *
 * An exit larger than the available stock arrives as {@link ApiError} with
 * `code: "insufficient_stock"` and a message that states the stock available;
 * the form surfaces that message instead of pretending the movement succeeded.
 *
 * `customerId` is the optional customer of a sale (MI-10). It travels in the
 * body **only when it is set**: an anonymous sale sends the same body it sent
 * before the association existed, and an entry never sends it at all — the API
 * answers `400 customer_requires_exit` if one arrives with `IN`.
 *
 * A sale of a product with units sends `unitIds` and `unitPrice` (L24). Those
 * units are marked `SOLD` by the same transaction, so the mutation invalidates
 * **that product's** units as well: without it the next sale would offer a unit
 * that already left, and the person would only find out when the API answered
 * `409 unit_not_available`.
 */
export function useRegisterMovement(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<
		RegisterMovementResponse,
		unknown,
		RegisterMovementRequest
	>({
		mutationFn: async ({ customerId, ...movement }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const body: RegisterMovementRequest = customerId
				? { ...movement, customerId }
				: movement;
			const response = await getApiClient({ getAccessToken }).post(
				`/companies/${companyId}/movements`,
				body,
			);
			return parseRegisterMovementResponse(response.data);
		},
		onSuccess: (_response, variables) => {
			queryClient.invalidateQueries({
				queryKey: movementsQueryPrefix(companyId),
			});
			queryClient.invalidateQueries({
				queryKey: productsQueryPrefix(companyId),
			});
			if (variables.unitIds && variables.unitIds.length > 0) {
				// La venta se llevó esas unidades: la lista del producto tiene que
				// volver a pedirse antes de ofrecer otra.
				queryClient.invalidateQueries({
					queryKey: productUnitsQueryKey(companyId, variables.productId),
				});
			}
		},
	});
}
