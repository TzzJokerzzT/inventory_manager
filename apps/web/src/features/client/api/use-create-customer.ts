"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import {
	type CreateCustomerRequest,
	type Customer,
	parseCustomer,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { customersQueryPrefix } from "./use-customers";

/**
 * Creates a customer (`POST /companies/{id}/customers`).
 *
 * The API answers the created customer, so the per-company list is the query
 * invalidated on success: the new row appears from the server's state — in the
 * server's order — instead of from a copy the form would have to keep in sync.
 * Every ACTIVE member may write, so the only failures worth translating are the
 * company guard (`403 company_access_forbidden`) and an invalid body (`400`),
 * both already carrying a user-facing Spanish message.
 */
export function useCreateCustomer(companyId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation<Customer, unknown, CreateCustomerRequest>({
		mutationFn: async (input) => {
			if (!companyId) {
				throw new Error("No active company");
			}
			const response = await getApiClient({ getAccessToken }).post(
				`/companies/${companyId}/customers`,
				input,
			);
			return parseCustomer(response.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: customersQueryPrefix(companyId),
			});
		},
	});
}
