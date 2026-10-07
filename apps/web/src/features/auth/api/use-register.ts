"use client";

import { useMutation } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import type { LoginValues } from "@/lib/auth/validation";

/**
 * Creates the account in Auth0 through our API.
 *
 * The response is deliberately generic: the API must not reveal whether the
 * address was already registered, so there is nothing to read out of it and no
 * boundary schema yet. **`POST /auth/register` does not exist at the time of
 * writing** (MI-53, blocked on a tenant setting), so this hook is wired but not
 * usable until that endpoint lands; the schema arrives with its contract.
 */
export function useRegister() {
	return useMutation<unknown, unknown, LoginValues>({
		mutationFn: async (values) => {
			const response = await getApiClient().post("/auth/register", values);
			return response.data;
		},
	});
}
