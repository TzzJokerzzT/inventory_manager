import type { Metadata } from "next";
import { RequireActiveCompany } from "@/src/features/company/components/require-active-company";
import { AppShell } from "@/src/features/shell/components/app-shell";

export const metadata: Metadata = {
	title: "Dashboard — Inventory Manager",
	description:
		"Panel de control con los indicadores de inventario de tu empresa.",
};

/**
 * `/dashboard` — the first route inside the shell.
 *
 * `RequireActiveCompany` wraps the shell (not the page content), so no internal
 * route renders without an active company. The KPIs, alerts and stock table are
 * built by MI-20 U2 and replace the placeholder heading here.
 */
export default function DashboardPage() {
	return (
		<RequireActiveCompany>
			<AppShell>
				<h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
			</AppShell>
		</RequireActiveCompany>
	);
}
