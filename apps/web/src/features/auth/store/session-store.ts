import { create } from "zustand";

/**
 * Local, in-memory session state.
 *
 * Only the access token lives here, and only in memory:
 * - the **refresh token is never stored client-side**: it is an `httpOnly`
 *   cookie the browser holds and sends by itself, which is the whole point of
 *   that decision;
 * - `localStorage` is out of the question for the access token too, because a
 *   single XSS would walk away with the session.
 *
 * A reload loses the token, and that is acceptable: the API can mint a new one
 * from the refresh cookie (MI-54 owns that endpoint).
 */
export interface SessionState {
	accessToken?: string;
	setSession: (session: { accessToken: string }) => void;
	clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
	accessToken: undefined,
	setSession: ({ accessToken }) => set({ accessToken }),
	clear: () => set({ accessToken: undefined }),
}));
