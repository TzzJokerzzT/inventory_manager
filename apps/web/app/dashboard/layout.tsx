import type { ReactNode } from "react";
import { RequireActiveCompany } from "@/src/features/company/components/require-active-company";
import { AppShell } from "@/src/layout/app-shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
	return (
		<RequireActiveCompany>
			<AppShell>{children}</AppShell>
		</RequireActiveCompany>
	);
}
