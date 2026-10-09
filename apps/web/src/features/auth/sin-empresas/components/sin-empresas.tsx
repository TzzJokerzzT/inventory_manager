"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SpinnerMotion } from "@/components/ui/spinner";
import { useCompanies } from "@/src/features/company/api/use-companies";
import { NoCompaniesState } from "@/src/features/company/components/no-companies-state";

/**
 * `/sin-empresas` — the bootstrap state for a user with no companies.
 *
 * Inverse rule: if the user already has companies, this screen is not for them
 * and they go to `/dashboard`. This redirect is the intentional counterpart of
 * `RequireActiveCompany`.
 */
export function SinEmpresas() {
	const router = useRouter();
	const { data: companies, isPending } = useCompanies();

	useEffect(() => {
		if (!isPending && (companies?.length ?? 0) > 0) {
			router.replace("/dashboard");
		}
	}, [isPending, companies, router]);

	if (isPending) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-background">
				<SpinnerMotion />
			</main>
		);
	}

	if ((companies?.length ?? 0) > 0) {
		// Redirect is in flight; render nothing so the form never flashes.
		return null;
	}

	return <NoCompaniesState />;
}
