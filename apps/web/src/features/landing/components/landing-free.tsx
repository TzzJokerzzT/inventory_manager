import { ArrowRight, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const INCLUDED = [
	"Todas las funciones, sin versión recortada",
	"Sin tarjeta de crédito ni prueba de 30 días",
	"Empresas y equipo incluidos",
	"Sin límite de tiempo: es gratis y sigue gratis",
] as const;

/**
 * The free claim, stated plainly.
 *
 * The product has no billing, no plan gate and no trial: saying "prueba gratis"
 * would be less true than "gratis", so the section commits to the plain version
 * and lists what that covers. If a paid tier ever exists, this is the block
 * that has to change first.
 */
export function LandingFree() {
	return (
		<section id="gratis" className="pb-16 lg:pb-20">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 sm:p-12">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 -z-10"
						style={{
							backgroundImage:
								"radial-gradient(60% 80% at 100% 0%, var(--primary-soft), transparent 65%)",
						}}
					/>
					<div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
						<div>
							<span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-text">
								<BadgeCheck aria-hidden="true" className="size-3.5" />
								Gratis, sin asteriscos
							</span>
							<h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
								No hay plan premium esperándote al final del mes
							</h2>
							<p className="mt-4 max-w-xl text-base text-text-secondary">
								Inventory Manager es una aplicación gratuita. Creás tu cuenta,
								cargás tu inventario y usás todo lo que viste arriba sin pagar
								nada y sin dejar datos de tarjeta en ningún lado.
							</p>
							<ul className="mt-6 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
								{INCLUDED.map((item) => (
									<li key={item} className="flex items-start gap-2">
										<BadgeCheck
											aria-hidden="true"
											className="mt-0.5 size-4 shrink-0 text-success-text"
										/>
										<span>{item}</span>
									</li>
								))}
							</ul>
						</div>

						<div className="flex flex-col gap-3">
							<Link
								href="/login"
								className={buttonVariants({ variant: "primary", size: "ds" })}
							>
								Entrar al panel
								<ArrowRight aria-hidden="true" className="size-4" />
							</Link>
							<Link
								href="/registro"
								className={buttonVariants({ variant: "outline", size: "ds" })}
							>
								Crear mi cuenta
							</Link>
							<p className="max-w-56 text-xs text-text-muted">
								Si ya tenés cuenta, entrás con tu email y contraseña.
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

/**
 * Closing footer: the product name, the two doors and nothing else.
 *
 * It repeats the login link on purpose — a visitor who scrolled the whole page
 * should not have to scroll back to find the way in.
 */
export function LandingFooter() {
	return (
		<footer className="border-t border-border bg-surface/60">
			<div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
				<p className="text-sm font-semibold text-text-primary">
					Inventory Manager
				</p>
				<nav aria-label="Accesos" className="flex items-center gap-4 text-sm">
					<Link
						href="/login"
						className="text-text-secondary transition-colors hover:text-text-primary"
					>
						Iniciar sesión
					</Link>
					<Link
						href="/registro"
						className="text-text-secondary transition-colors hover:text-text-primary"
					>
						Crear cuenta
					</Link>
				</nav>
				<p className="text-xs text-text-muted">
					Hecho para negocios que quieren saber qué tienen.
				</p>
			</div>
		</footer>
	);
}
