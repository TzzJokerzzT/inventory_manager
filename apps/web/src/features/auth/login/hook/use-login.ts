"use client";

import { useMutation } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api/client";
import { type LoginResponse, parseLoginResponse } from "@/lib/api/schemas";
import type { LoginValues } from "@/lib/auth/validation";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { useSessionStore } from "@/src/store/session-store/session-store";

/**
 * Sends the credentials to our API, which exchanges them with Auth0.
 *
 * The password goes straight through the request body and is never kept: what
 * ends up in state is the access token the API returned, validated at the
 * boundary before it is trusted.
 *
 * The request marks itself with `skipAuthRefresh` so a 401 (invalid
 * credentials) never triggers the refresh interceptor: a failed sign-in must
 * leave the session exactly as it was, not mint a token from a lingering
 * refresh cookie while the person reads "credenciales inválidas".
 */
export function useLogin() {
	const setSession = useSessionStore((state) => state.setSession);

	return useMutation<LoginResponse, unknown, LoginValues>({
		mutationFn: async (values) => {
			const response = await getApiClient({ getAccessToken }).post(
				"/auth/login",
				values,
				{ skipAuthRefresh: true },
			);
			return parseLoginResponse(response.data);
		},
		onSuccess: (data) => {
			setSession({ accessToken: data.accessToken });
		},
	});
}
