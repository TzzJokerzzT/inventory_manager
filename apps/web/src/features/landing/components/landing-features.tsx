import {
	ArrowLeftRight,
	Building2,
	LineChart,
	Package,
	Users,
	UsersRound,
} from "lucide-react";

interface Feature {
	icon: typeof Package;
	title: string;
	body: string;
}

/**
 * The six things the product actually does today, each one traceable to a
 * shipped flow: catalogue, movements, dashboard, customers, multi-company and
 * team roles. Nothing here promises a roadmap item — a landing that sells a
 * feature the app lacks is the most expensive bug to find later.
 */
const FEATURES: readonly Feature[] = [
	{
		icon: Package,
		title: "Catálogo ordenado",
		body: "Cada producto con su nombre, SKU, precio, descripción y foto. Buscás por nombre o SKU y aparece al instante.",
	},
	{
		icon: ArrowLeftRight,
		title: "Entradas y salidas con historial",
		body: "Registrás cada movimiento de stock y queda con fecha, cantidad, motivo y responsable: sabés qué pasó y cuándo.",
	},
	{
		icon: LineChart,
		title: "Panel que muestra la tendencia",
		body: "Productos activos, valor del inventario y la evolución de entradas y salidas de los últimos 30 días, en gráficos.",
	},
	{
		icon: Users,
		title: "Clientes en el mismo lugar",
		body: "Guardás a quién le vendiste y filtrás los movimientos por cliente, sin una planilla aparte para cada cosa.",
	},
	{
		icon: Building2,
		title: "Varias empresas, una sesión",
		body: "Si manejás más de un negocio, cambiás de empresa con un clic: catálogo, movimientos y reportes quedan separados.",
	},
	{
		icon: UsersRound,
		title: "Equipo con roles",
		body: "Invitás a tu equipo por email con permisos de dueño, administrador o miembro, y recibís aviso cuando aceptan.",
	},
];

/**
 * Feature grid.
 *
 * It is a definition list semantically (`dl`/`dt`/`dd` is overkill for cards),
 * so the section uses one `h2` plus `h3` titles: a visitor scanning with a
 * screen reader hears the section and then each card, in order.
 */
export function LandingFeatures() {
	return (
		<section
			id="features"
			className="border-y border-border bg-surface/60 py-16 lg:py-20"
		>
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="max-w-2xl">
					<p className="text-xs font-semibold tracking-wide text-primary uppercase">
						Funciones
					</p>
					<h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
						Todo lo que necesitás para no perder el hilo del stock
					</h2>
					<p className="mt-4 text-base text-text-secondary">
						Sin módulos que se compran aparte ni planillas que se desactualizan:
						las seis piezas están incluidas desde el primer día.
					</p>
				</div>

				<ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{FEATURES.map((feature) => (
						<li
							key={feature.title}
							className="rounded-2xl border border-border bg-background p-5 transition-colors hover:border-primary/40"
						>
							<span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
								<feature.icon aria-hidden="true" className="size-5" />
							</span>
							<h3 className="mt-4 text-base font-bold text-text-primary">
								{feature.title}
							</h3>
							<p className="mt-2 text-sm text-text-secondary">{feature.body}</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
