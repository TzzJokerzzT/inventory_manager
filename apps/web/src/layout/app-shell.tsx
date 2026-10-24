"use client";

import { cn } from "cn";
import {
	ArrowRightLeft,
	ChevronsLeft,
	LayoutDashboard,
	type LucideIcon,
	Package,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CompanySwitcher } from "@/src/features/company/components/company-switcher";
import { UserMenu } from "./user-menu";

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
 * the company switcher, the user menu (account actions and logout) and the theme toggle, plus the
 * content area.
 *
 * The shell is pinned to the viewport (`fixed inset-0`) instead of merely being
 * `h-dvh` in the document flow: the page itself must never scroll, so the
 * document cannot gain a scrollbar that would drag the sidebar and the header
 * away when the content ends. `main` is the only scroll container, and
 * `overscroll-contain` stops the scroll from chaining to the document at the
 * end of the view.
 *
 * Below `lg` the sidebar is an icon-only rail that the user can expand (it
 * overlays the content instead of pushing it). From `lg` it is the regular
 * fixed sidebar.
 *
 * It assumes the caller already guaranteed an active company (the dashboard
 * wraps it in `RequireActiveCompany`), so it renders no company fallback of
 * its own.
 */
export function AppShell({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const [expanded, setExpanded] = useState(false);
	const asideId = useId();
	const mainRef = useRef<HTMLElement>(null);

	// Close the expanded sidebar with Escape.
	useEffect(() => {
		if (!expanded) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setExpanded(false);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [expanded]);

	// `main` is the scroll container, so reset it on every route change.
	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
	useEffect(() => {
		mainRef.current?.scrollTo({ top: 0 });
	}, [pathname]);

	// Visually hidden when collapsed (below lg) but still read by screen readers.
	const collapsibleText = expanded ? "" : "sr-only lg:not-sr-only";

	return (
		<div className="fixed inset-0 flex overflow-hidden bg-background">
			<div className="relative w-16 shrink-0 lg:w-60">
				{expanded && (
					<div
						aria-hidden="true"
						onClick={() => setExpanded(false)}
						className="fixed inset-0 z-30 bg-black/40 lg:hidden"
					/>
				)}

				<aside
					id={asideId}
					className={`absolute inset-y-0 left-0 z-40 flex h-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:static lg:w-60 ${
						expanded ? "w-60" : "w-16"
					}`}
				>
					<div className="flex items-center gap-3 px-4 py-5 lg:px-6">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary">
							<div className="size-3 rounded-[3px] bg-white" />
						</div>
						<span
							className={`truncate text-base font-bold text-sidebar-foreground ${collapsibleText}`}
						>
							Inventory Manager
						</span>
					</div>

					<nav
						aria-label="Principal"
						className="flex-1 overflow-y-auto px-3 py-4"
					>
						<ul className="flex flex-col gap-1">
							{navigation.map((entry) => {
								const Icon = entry.icon;

								if (isLink(entry)) {
									return (
										<li key={entry.href}>
											<Link
												href={entry.href}
												title={entry.label}
												onClick={() => setExpanded(false)}
												className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
											>
												<Icon aria-hidden="true" className="size-4 shrink-0" />
												<span className={`truncate ${collapsibleText}`}>
													{entry.label}
												</span>
											</Link>
										</li>
									);
								}

								return (
									<li key={entry.label}>
										<span
											aria-disabled="true"
											title={`${entry.label} · Disponible en ${entry.mi}`}
											className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/50"
										>
											<Icon aria-hidden="true" className="size-4 shrink-0" />
											<span className={`flex-1 truncate ${collapsibleText}`}>
												{entry.label}
											</span>
											<span
												className={`rounded-sm bg-sidebar-accent px-1.5 py-0.5 text-xs font-semibold text-sidebar-foreground/70 ${
													expanded ? "" : "hidden lg:inline"
												}`}
											>
												{entry.mi}
											</span>
										</span>
									</li>
								);
							})}
						</ul>
					</nav>

					<div className="border-t border-sidebar-border p-3 lg:hidden">
						<button
							type="button"
							onClick={() => setExpanded((prev) => !prev)}
							aria-expanded={expanded}
							aria-controls={asideId}
							aria-label={expanded ? "Contraer menú" : "Desplegar menú"}
							className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
						>
							<ChevronsLeft
								aria-hidden="true"
								className={cn(
									"size-4 shrink-0 transition-transform",
									expanded && "rotate-180",
								)}
							/>
							{expanded && <span>Contraer</span>}
						</button>
					</div>
				</aside>
			</div>

			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 sm:gap-4 sm:px-6">
					<div className="min-w-0">
						<CompanySwitcher />
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<UserMenu />
						<ThemeToggle />
					</div>
				</header>

				<main
					ref={mainRef}
					className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"
				>
					{children}
				</main>
			</div>
		</div>
	);
}
