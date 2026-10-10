"use client";

import {
	ArrowRightLeft,
	LayoutDashboard,
	LogOut,
	type LucideIcon,
	Package,
	Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/src/features/auth/logout/use-logout";
import { CompanySwitcher } from "@/src/features/company/components/company-switcher";

type NavLinkEntry = { href: string; label: string; icon: LucideIcon };

/**
 * A not-yet-built module: rendered disabled and labelled with its MI so the
 * navigation never points at a route that 404s.
 */
type NavDisabledEntry = { label: string; mi: string; icon: LucideIcon };

type NavEntry = NavLinkEntry | NavDisabledEntry;

const navigation: NavEntry[] = [
	{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/dashboard/products", label: "Productos", icon: Package },
	{ href: "/dashboard/movements", label: "Movimientos", icon: ArrowRightLeft },
	{ href: "/dashboard/clients", label: "Clientes", icon: Users },
	{ href: "/dashboard/user", label: "Usuario", icon: Users },
];

function isLink(entry: NavEntry): entry is NavLinkEntry {
	return "href" in entry;
}

/**
 * The application shell: dark sidebar with the navigation, a topbar carrying
 * the company switcher, the user area (logout) and the theme toggle, plus the
 * content area.
 *
 * It assumes the caller already guaranteed an active company (the dashboard
 * wraps it in `RequireActiveCompany`), so it renders no company fallback of
 * its own.
 */
export function AppShell({ children }: { children: ReactNode }) {
	const logout = useLogout();

	return (
		<div className="flex min-h-screen bg-background">
			<aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
				<div className="flex items-center gap-3 px-6 py-5">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary">
						<div className="size-3 rounded-[3px] bg-white" />
					</div>
					<span className="text-base font-bold text-sidebar-foreground">
						Inventory Manager
					</span>
				</div>

				<nav aria-label="Principal" className="flex-1 px-3 py-4">
					<ul className="flex flex-col gap-1">
						{navigation.map((entry) => {
							const Icon = entry.icon;

							if (isLink(entry)) {
								return (
									<li key={entry.href}>
										<Link
											href={entry.href}
											className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
										>
											<Icon aria-hidden="true" className="size-4" />
											<span>{entry.label}</span>
										</Link>
									</li>
								);
							}

							return (
								<li key={entry.label}>
									<span
										aria-disabled="true"
										title={`Disponible en ${entry.mi}`}
										className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/50"
									>
										<Icon aria-hidden="true" className="size-4" />
										<span className="flex-1">{entry.label}</span>
										<span className="rounded-sm bg-sidebar-accent px-1.5 py-0.5 text-xs font-semibold text-sidebar-foreground/70">
											{entry.mi}
										</span>
									</span>
								</li>
							);
						})}
					</ul>
				</nav>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-6">
					<CompanySwitcher />
					<div className="flex items-center gap-2">
						<Button
							type="button"
							onClick={() => logout()}
							variant="outline"
							className="rounded-md "
						>
							<LogOut aria-hidden="true" className="size-4" />
							Salir
						</Button>
					</div>
				</header>

				<main className="flex-1 p-6">{children}</main>
			</div>
		</div>
	);
}
