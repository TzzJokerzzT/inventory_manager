"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type Customer,
	parseCustomer,
	type UpdateCustomerRequest,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { customerQueryKey } from "./use-customer";
import { customersQueryPrefix } from "./use-customers";

/** One update: the customer to patch plus the fields that actually change. */
export type UpdateCustomerInput = UpdateCustomerRequest & {
	customerId: string;
};

/**
 * Edits a customer (`PATCH /companies/{id}/customers/{customerId}`).
 *
 * `customerId` is the target of the request, never part of the body: the body is
 * the partial update the contract describes, where an absent field keeps its
 * value and `null` clears `email`, `phone` or `address`. On success both the
 * list (every cached search of the company) and the customer's own detail key
 * are invalidated, so no view keeps a stale copy.
 */
export function useUpdateCustomer(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Customer, unknown, UpdateCustomerInput>({
		mutationFn: async ({ customerId, ...body }) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).patch(
				`/companies/${companyId}/customers/${customerId}`,
				body,
			);
			return parseCustomer(response.data);
		},
		onSuccess: (_customer, { customerId }) => {
			queryClient.invalidateQueries({
				queryKey: customersQueryPrefix(companyId),
			});
			queryClient.invalidateQueries({
				queryKey: customerQueryKey(companyId, customerId),
			});
		},
	});
}
