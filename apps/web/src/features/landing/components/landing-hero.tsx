import {
	ArrowDownToLine,
	ArrowRight,
	ArrowUpFromLine,
	Sparkles,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Bars of the decorative panel, in percent; fixed so the mock never moves. */
const TREND = [38, 52, 44, 68, 58, 74, 62, 81, 70, 88, 76, 95] as const;

/**
 * Decorative product panel for the hero.
 *
 * It is a mock built from divs, not a real chart: the landing has no session,
 * no company and no data to read, and pulling a chart library in for a
 * screenshot would ship kilobytes for nothing. It is `aria-hidden` because the
 * copy next to it already says what the product does; a screen reader gains
 * nothing from fake numbers.
 */
function PanelPreview() {
	return (
		<div aria-hidden="true" className="relative">
			<div
				className="absolute -inset-6 -z-10 rounded-3xl opacity-70 blur-2xl"
				style={{
					backgroundImage:
						"radial-gradient(60% 60% at 30% 20%, var(--primary-soft), transparent 70%)",
				}}
			/>
			<div className="rounded-2xl border border-border bg-surface p-5 shadow-lg">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
							Panel
						</p>
						<p className="text-sm font-bold text-text-primary">
							Café del Sur · Depósito
						</p>
					</div>
					<span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
						Últimos 30 días
					</span>
				</div>

				<div className="mt-4 grid grid-cols-2 gap-3">
					<div className="rounded-xl border border-border bg-background p-3">
						<p className="text-xs text-text-muted">Productos activos</p>
						<p className="text-2xl font-bold text-text-primary">248</p>
					</div>
					<div className="rounded-xl border border-border bg-background p-3">
						<p className="text-xs text-text-muted">Sin stock</p>
						<p className="text-2xl font-bold text-danger-text">6</p>
					</div>
				</div>

				<div className="mt-4 rounded-xl border border-border bg-background p-4">
					<div className="flex items-baseline justify-between">
						<p className="text-xs text-text-muted">Entradas y salidas</p>
						<p className="text-xs font-semibold text-success-text">
							+12% este mes
						</p>
					</div>
					<div className="mt-3 flex h-24 items-end gap-1.5">
						{TREND.map((height, index) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: the bars are a frozen decorative series
								key={index}
								className="flex-1 rounded-sm bg-primary/80"
								style={{ height: `${height}%` }}
							/>
						))}
					</div>
				</div>

				<ul className="mt-4 space-y-2 text-sm">
					<li className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
						<span className="grid size-7 place-items-center rounded-md bg-success-soft text-success-text">
							<ArrowDownToLine className="size-4" />
						</span>
						<span className="flex-1 text-text-primary">Yerba 1 kg</span>
						<span className="font-semibold text-success-text">+24</span>
					</li>
					<li className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
						<span className="grid size-7 place-items-center rounded-md bg-danger-soft text-danger-text">
							<ArrowUpFromLine className="size-4" />
						</span>
						<span className="flex-1 text-text-primary">Filtro V60</span>
						<span className="font-semibold text-danger-text">−3</span>
					</li>
				</ul>
			</div>
		</div>
	);
}

/**
 * Hero of the public landing: what the product is, and the door into the app.
 *
 * The two calls to action are links, not buttons: they navigate, and a link is
 * what a keyboard, a screen reader and "open in a new tab" all understand. Both
 * enter through `/login`, which is the only public entry the app has; the
 * secondary one lands on the registration form.
 */
export function LandingHero() {
	return (
		<section id="producto" className="relative overflow-hidden">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10"
				style={{
					backgroundImage:
						"radial-gradient(50% 45% at 85% 0%, var(--primary-soft), transparent 70%), radial-gradient(40% 40% at 0% 30%, var(--info-soft), transparent 70%)",
				}}
			/>
			<div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
				<div>
					<span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-secondary">
						<Sparkles aria-hidden="true" className="size-3.5 text-primary" />
						Gratis · Sin tarjeta · Multi-empresa
					</span>

					<h1 className="mt-5 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
						El inventario de tu negocio,{" "}
						<span className="bg-gradient-to-r from-primary to-info-text bg-clip-text text-transparent">
							siempre al día
						</span>
					</h1>

					<p className="mt-5 max-w-xl text-base text-text-secondary sm:text-lg">
						Inventory Manager junta en un solo panel lo que hoy vive en
						planillas sueltas: tus productos con SKU, precio y foto, cada
						entrada y salida de stock, tus clientes y el estado del depósito en
						tiempo real.
					</p>

					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
					</div>

					<ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-muted">
						<li>Sin instalar nada</li>
						<li aria-hidden="true">·</li>
						<li>Funciona en el navegador</li>
						<li aria-hidden="true">·</li>
						<li>Gratis todos los meses</li>
					</ul>
				</div>

				<PanelPreview />
			</div>
		</section>
	);
}
