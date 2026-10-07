import { useSessionStore } from "../store/session-store";

/**
 * Reads the access token for the API client's request interceptor.
 *
 * The API client stays generic — it cannot import a feature — so the auth
 * feature hands this callback over when it builds the client. It reads the
 * store lazily at request time, so a token set after the client was built is
 * still picked up.
 *
 * This provider is passed by `useLogin`, `useRegister` and `useCompanies` on
 * purpose: `getApiClient` captures its options on the first call, so a single
 * hook that skips the provider would leave the shared client token-less and
 * turn every later request into a 401 that depends on which page loaded first.
 */
export function getAccessToken(): string | undefined {
	return useSessionStore.getState().accessToken;
}
