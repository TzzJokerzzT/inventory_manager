"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type Customer, parseCustomer } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";

/** Shared cache key: one customer of one company. */
export function customerQueryKey(
	companyId: string | undefined,
	customerId: string | undefined,
) {
	return ["customer", companyId, customerId] as const;
}

/**
 * Reads one customer (`GET /companies/{id}/customers/{customerId}`).
 *
 * The edit form runs on the same page as the list, but it cannot rely on the
 * list being warm: the cache may be empty after a reload and the row the person
 * clicked could already be gone. Reading the customer here gives the form its
 * own source of truth and turns a soft-deleted or foreign id into the API's
 * `404 customer_not_found` instead of a silently empty form.
 * `useUpdateCustomer` invalidates this key on success, so a stale copy never
 * survives an edit.
 */
export function useCustomer(
	companyId: string | undefined,
	customerId: string | undefined,
) {
	return useQuery<Customer>({
		queryKey: customerQueryKey(companyId, customerId),
		enabled: companyId !== undefined && customerId !== undefined,
		queryFn: async () => {
			if (!companyId || !customerId) {
				throw new Error("No active company or customer");
			}
			const response = await getApiClient({ getAccessToken }).get(
				`/companies/${companyId}/customers/${customerId}`,
			);
			return parseCustomer(response.data);
		},
	});
}
