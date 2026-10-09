import type { Metadata } from "next";
import { DashboardView } from "@/src/view/Dashboard/dashboard-view";

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
	return <DashboardView />;
}
