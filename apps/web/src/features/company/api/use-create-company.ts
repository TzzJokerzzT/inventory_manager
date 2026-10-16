"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type Company, parseCompany } from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { useCompanyStore } from "../store/company-store";

/**
 * Creates a company the caller owns (`POST /companies` with `{ name }`).
 *
 * The API returns the created company (MI-44 mints the `OWNER`/`ACTIVE`
 * membership server-side), so on success the created company is made active
 * and the companies list is invalidated: the rest of the app gets a context
 * immediately, without a round-trip through the switcher.
 */
export function useCreateCompany() {
	const queryClient = useQueryClient();
	const setActiveCompanyId = useCompanyStore(
		(state) => state.setActiveCompanyId,
	);

	return useMutation<Company, unknown, { name: string }>({
		mutationFn: async ({ name }) => {
			const response = await getApiClient({ getAccessToken }).post(
				"/companies",
				{ name },
			);
			return parseCompany(response.data);
		},
		onSuccess: (company) => {
			queryClient.invalidateQueries({ queryKey: ["companies"] });
			setActiveCompanyId(company.id);
		},
	});
}
