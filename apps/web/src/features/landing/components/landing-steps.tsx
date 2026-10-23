import { MonitorSmartphone, ShieldCheck, Wand2 } from "lucide-react";

const STEPS = [
	{
		title: "Creá tu empresa",
		body: "Entrás con tu email, ponés el nombre de tu negocio y quedás como dueño. Tarda menos que abrir una planilla.",
	},
	{
		title: "Cargá tus productos",
		body: "Nombre, SKU, precio, stock inicial y una foto si querés. Podés cargar de a uno y editarlos cuando quieras.",
	},
	{
		title: "Registrá y mirá el panel",
		body: "Cada venta o reposición es un movimiento; el panel suma los números solo y te muestra lo que se está por agotar.",
	},
] as const;

const EASES = [
	{
		icon: MonitorSmartphone,
		title: "En el navegador, desde cualquier equipo",
		body: "No hay nada que instalar ni actualizar, y la interfaz se adapta al tamaño de tu pantalla.",
	},
	{
		icon: ShieldCheck,
		title: "Cada uno con su acceso",
		body: "Los roles separan quién ve, quién edita y quién administra el equipo. Nadie comparte una contraseña.",
	},
	{
		icon: Wand2,
		title: "Sin curva de aprendizaje",
		body: "Las pantallas siguen el mismo orden que el trabajo real: producto, movimiento, panel.",
	},
] as const;

/**
 * "How it works" plus the three ease claims.
 *
 * The steps are an ordered list because the order is the point: an onboarding
 * explanation read out of order is wrong, and `ol` is what tells assistive
 * technology that.
 */
export function LandingSteps() {
	return (
		<section id="facilidad" className="py-16 lg:py-20">
			<div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
				<div>
					<p className="text-xs font-semibold tracking-wide text-primary uppercase">
						Cómo funciona
					</p>
					<h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
						Tres pasos y ya estás trabajando
					</h2>
					<p className="mt-4 text-base text-text-secondary">
						Sin migraciones, sin capacitación y sin esperar a que alguien te
						configure la cuenta.
					</p>

					<ol className="mt-8 space-y-5">
						{STEPS.map((step, index) => (
							<li key={step.title} className="flex gap-4">
								<span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
									{index + 1}
								</span>
								<div>
									<h3 className="text-base font-bold text-text-primary">
										{step.title}
									</h3>
									<p className="mt-1 text-sm text-text-secondary">
										{step.body}
									</p>
								</div>
							</li>
						))}
					</ol>
				</div>

				<ul className="grid gap-4 self-center sm:grid-cols-1">
					{EASES.map((ease) => (
						<li
							key={ease.title}
							className="flex gap-4 rounded-2xl border border-border bg-surface p-5"
						>
							<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info-soft text-info-text">
								<ease.icon aria-hidden="true" className="size-5" />
							</span>
							<div>
								<h3 className="text-base font-bold text-text-primary">
									{ease.title}
								</h3>
								<p className="mt-1 text-sm text-text-secondary">{ease.body}</p>
							</div>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
