"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SpinnerMotion } from "@/components/ui/spinner";
import { useCompanies } from "@/src/features/company/api/use-companies";
import { NoCompaniesState } from "@/src/features/company/components/no-companies-state";
import { useMe } from "@/src/features/user/api/use-me";
import { FullNameForm } from "@/src/features/user/components/full-name-form";

/**
 * `/sin-empresas` — the bootstrap state for a user with no companies.
 *
 * Inverse rule: if the user already has companies, this screen is not for them
 * and they go to `/dashboard`. This redirect is the intentional counterpart of
 * `RequireActiveCompany`.
 *
 * Blocking gate: the invariant is "no company without a name", so while the
 * user has no `fullName` this screen asks for it and the company card stays
 * hidden. Both `/me` and the company list are read here; the form's success
 * invalidates `["me"]`, this hook re-reads, and the screen moves on to the
 * company card without duplicating the name in local state.
 */
export function SinEmpresas() {
	const router = useRouter();
	const { data: companies, isPending } = useCompanies();
	const { data: me, isPending: isMePending, isError: isMeError } = useMe();

	useEffect(() => {
		if (!isPending && (companies?.length ?? 0) > 0) {
			router.replace("/dashboard");
		}
	}, [isPending, companies, router]);

	if (isPending || isMePending) {
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

	// Fail-closed: when `/me` errors there is no way to prove the user has a
	// name, so the form blocks instead of ever showing the company card
	// unverified.
	const hasFullName = !isMeError && (me?.fullName?.trim() ?? "") !== "";

	if (!hasFullName) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
				<section
					aria-labelledby="full-name-heading"
					className="flex w-full max-w-md flex-col gap-6 rounded-md border border-border bg-surface p-8"
				>
					<div className="flex flex-col gap-2">
						<h1
							id="full-name-heading"
							className="text-2xl font-bold text-text-primary"
						>
							Completá tu nombre
						</h1>
						<p className="text-base text-text-secondary">
							Antes de crear tu empresa necesitamos saber quién sos. Vas a poder
							crear tu empresa apenas lo guardes.
						</p>
					</div>

					<FullNameForm />
				</section>
			</main>
		);
	}

	return <NoCompaniesState />;
}
