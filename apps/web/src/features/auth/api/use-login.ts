"use client";

import { useMutation } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type LoginResponse, parseLoginResponse } from "@/lib/api/schemas";
import type { LoginValues } from "@/lib/auth/validation";
import { useSessionStore } from "../store/session-store";

/**
 * Sends the credentials to our API, which exchanges them with Auth0.
 *
 * The password goes straight through the request body and is never kept: what
 * ends up in state is the access token the API returned, validated at the
 * boundary before it is trusted.
 */
export function useLogin() {
	const setSession = useSessionStore((state) => state.setSession);

	return useMutation<LoginResponse, unknown, LoginValues>({
		mutationFn: async (values) => {
			const response = await getApiClient().post("/auth/login", values);
			return parseLoginResponse(response.data);
		},
		onSuccess: (data) => {
			setSession({ accessToken: data.accessToken });
		},
	});
}
