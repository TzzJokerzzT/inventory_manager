"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * Provides the server-state cache.
 *
 * The client is created **inside** the component and kept in state, not at
 * module scope: a module-level client is shared across requests and users, so
 * one user's cached data could be served to another.
 *
 * Defaults, and why: a short `staleTime` because inventory data is per-company
 * and changes while people work; `retry: 1` because a second attempt usually
 * separates a blip from an outage; and no refetch on window focus because the
 * data does not move behind the user's back often enough to pay for the extra
 * requests.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						retry: 1,
						refetchOnWindowFocus: false,
					},
				},
			}),
	);

	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
