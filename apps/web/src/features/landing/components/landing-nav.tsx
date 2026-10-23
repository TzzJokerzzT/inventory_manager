import { Boxes } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const SECTIONS = [
	{ href: "#features", label: "Funciones" },
	{ href: "#facilidad", label: "Cómo funciona" },
	{ href: "#gratis", label: "Gratis" },
] as const;

/**
 * Public top bar for the landing.
 *
 * It is a server component on purpose: the landing is the first paint a
 * visitor sees, so it ships no client JavaScript. The anchors are plain
 * fragments — smooth scrolling is left to the browser — and the only action is
 * the link into `/login`.
 */
export function LandingNav() {
	return (
		<header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
				<Link
					href="/"
					className="flex items-center gap-2 rounded-lg font-bold text-text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
				>
					<span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
						<Boxes aria-hidden="true" className="size-5" />
					</span>
					<span className="text-base">Inventory Manager</span>
				</Link>

				<nav
					aria-label="Secciones de la página"
					className="hidden items-center gap-6 text-sm text-text-secondary md:flex"
				>
					{SECTIONS.map((section) => (
						<a
							key={section.href}
							href={section.href}
							className="rounded-md transition-colors hover:text-text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
						>
							{section.label}
						</a>
					))}
				</nav>

				<Link
					href="/login"
					className={buttonVariants({ variant: "primary", size: "sm" })}
				>
					Iniciar sesión
				</Link>
			</div>
		</header>
	);
}
