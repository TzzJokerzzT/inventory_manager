"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { useSessionStore } from "@/src/store/session-store/session-store";
import { useCompanies } from "../api/use-companies";

/**
 * Wraps routes that need an active company.
 *
 * Ready to wrap the dashboard (MI-20/MI-28): those views do not exist yet, so
 * nothing mounts it today. It waits for the session bootstrap to resolve before
 * deciding, then handles its four states:
 * - loading → a loading state, not a route jump, so nothing flickers;
 * - error → a message with a retry;
 * - zero companies → redirect to `/sin-empresas`;
 * - one or more → render the children.
 */
export function RequireActiveCompany({ children }: { children: ReactNode }) {
	const router = useRouter();
	const resolved = useSessionStore((state) => state.resolved);
	const {
		data: companies,
		isPending,
		isError,
		error,
		refetch,
	} = useCompanies();

	const unauthorized =
		isError && error instanceof ApiError && error.status === 401;

	useEffect(() => {
		if (!resolved) {
			// The session bootstrap is still deciding; a 401 here is not a
			// verdict yet (the refresh cookie may still be valid).
			return;
		}
		if (isPending) {
			return;
		}
		if (unauthorized) {
			router.replace("/login");
			return;
		}
		if (isError) {
			// A non-401 error shows the retry UI; it is not a signal about how
			// many companies exist, so it must not trigger a route jump.
			return;
		}
		if ((companies?.length ?? 0) === 0) {
			router.replace("/sin-empresas");
		}
	}, [resolved, isPending, unauthorized, isError, companies, router]);

	if (!resolved || isPending) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<SpinnerMotion />
			</div>
		);
	}

	if (unauthorized) {
		// The redirect is in flight; render nothing until `/login` mounts.
		return null;
	}

	if (isError) {
		const message =
			error instanceof ApiError
				? error.message
				: "No pudimos cargar tus empresas. Probá de nuevo.";
		return (
			<main className="flex min-h-screen items-center justify-center bg-background px-4">
				<div className="flex w-full max-w-md flex-col gap-4">
					<Alert variant="danger" title="No pudimos cargar tus empresas">
						{message}
					</Alert>
					<Button variant="secondary" size="ds" onClick={() => refetch()}>
						Reintentar
					</Button>
				</div>
			</main>
		);
	}

	if ((companies?.length ?? 0) === 0) {
		// The redirect is in flight; render nothing so the children never flash.
		return null;
	}

	return <>{children}</>;
}
