import type { Metadata } from "next";
import { RequireActiveCompany } from "@/src/features/company/components/require-active-company";
import { DashboardView } from "@/src/features/dashboard/components/dashboard-view";
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
 * route renders without an active company. The content (KPIs, stock alerts and
 * the critical-stock table) is `DashboardView` (MI-20 U2).
 */
export default function DashboardPage() {
	return (
		<RequireActiveCompany>
			<AppShell>
				<DashboardView />
			</AppShell>
		</RequireActiveCompany>
	);
}
