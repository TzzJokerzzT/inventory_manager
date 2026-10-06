import { cn } from "cn";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
	Alert,
	type Column,
	DataTable,
	designTokens,
	KpiCard,
	SelectField,
	StockBadge,
	type StockStatus,
	stockStatus,
	TextField,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "Design System — Inventory Manager",
	description:
		"Paleta de color, tipografía y componentes base del sistema de diseño de Inventory Manager.",
};

// Tailwind v4 discovers classes by scanning source, so each swatch maps to a
// literal token utility rather than a dynamically built `bg-${name}` string.
const palette: Array<{ token: string; swatch: string }> = [
	{ token: "primary", swatch: "bg-primary" },
	{ token: "primary-hover", swatch: "bg-primary-hover" },
	{ token: "primary-soft", swatch: "bg-primary-soft" },
	{ token: "success", swatch: "bg-success" },
	{ token: "success-soft", swatch: "bg-success-soft" },
	{ token: "success-text", swatch: "bg-success-text" },
	{ token: "warning", swatch: "bg-warning" },
	{ token: "warning-soft", swatch: "bg-warning-soft" },
	{ token: "warning-text", swatch: "bg-warning-text" },
	{ token: "destructive", swatch: "bg-destructive" },
	{ token: "danger-soft", swatch: "bg-danger-soft" },
	{ token: "danger-text", swatch: "bg-danger-text" },
	{ token: "info", swatch: "bg-info" },
	{ token: "info-soft", swatch: "bg-info-soft" },
	{ token: "info-text", swatch: "bg-info-text" },
	{ token: "background", swatch: "bg-background" },
	{ token: "surface", swatch: "bg-surface" },
	{ token: "surface-muted", swatch: "bg-surface-muted" },
	{ token: "border", swatch: "bg-border" },
	{ token: "text-primary", swatch: "bg-text-primary" },
	{ token: "text-secondary", swatch: "bg-text-secondary" },
	{ token: "text-muted", swatch: "bg-text-muted" },
	{ token: "sidebar", swatch: "bg-sidebar" },
	{ token: "chart-1", swatch: "bg-chart-1" },
	{ token: "chart-2", swatch: "bg-chart-2" },
	{ token: "chart-3", swatch: "bg-chart-3" },
	{ token: "chart-4", swatch: "bg-chart-4" },
	{ token: "chart-5", swatch: "bg-chart-5" },
];

const typeScale: Array<{ spec: string; sample: string; className: string }> = [
	{
		spec: "H1 · 32/40 · Bold",
		sample: "Encabezado principal",
		className: "text-[2rem] font-bold leading-10",
	},
	{
		spec: "H2 · 24/32 · Bold",
		sample: "Encabezado de sección",
		className: "text-2xl font-bold leading-8",
	},
	{
		spec: "H3 · 20/28 · Bold",
		sample: "Encabezado de subsección",
		className: "text-xl font-bold leading-7",
	},
	{
		spec: "Body · 16/24 · Regular",
		sample: "Texto de cuerpo",
		className: "text-base font-normal leading-6",
	},
	{
		spec: "Small · 14/20 · Regular",
		sample: "Texto pequeño",
		className: "text-sm font-normal leading-5",
	},
	{
		spec: "Caption · 12/16 · Regular",
		sample: "Texto de pie",
		className: "text-xs font-normal leading-4",
	},
];

type ProductRow = {
	name: string;
	sku: string;
	category: string;
	price: string;
	units: number;
	status: StockStatus;
};

const productColumns: Column<ProductRow>[] = [
	{ key: "name", header: "Producto" },
	{ key: "sku", header: "SKU" },
	{ key: "category", header: "Categoría" },
	{ key: "price", header: "Precio", align: "right" },
	{ key: "units", header: "Unidades", align: "right" },
	{
		key: "status",
		header: "Estado",
		render: (row) => <StockBadge status={row.status} />,
	},
	{
		key: "actions",
		header: "Acciones",
		render: () => (
			<a href="#editar" className="text-link hover:underline">
				Editar
			</a>
		),
	},
];

const productRows: ProductRow[] = [
	{
		name: "Cable HDMI 2.1 · 3 m",
		sku: "ELEC-HDMI-3M",
		category: "Electrónica",
		price: "$ 24.900",
		units: 4,
		status: "out_of_stock",
	},
	{
		name: "Teclado mecánico RGB",
		sku: "ELEC-KB-RGB",
		category: "Electrónica",
		price: "$ 189.000",
		units: 18,
		status: "low_stock",
	},
	{
		name: 'Monitor 27" 4K IPS',
		sku: "ELEC-MON-27-4K",
		category: "Electrónica",
		price: "$ 1.240.000",
		units: 142,
		status: "in_stock",
	},
];

function Section({
	index,
	title,
	children,
}: {
	index: number;
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="rounded-md border border-border bg-surface p-6">
			<h2 className="text-xl font-bold leading-7 text-text-primary">
				<span className="text-text-muted">{index}.</span> {title}
			</h2>
			<div className="mt-4">{children}</div>
		</section>
	);
}

function Note({ children }: { children: ReactNode }) {
	return <p className="text-sm text-text-muted">{children}</p>;
}

export default function DesignSystemPage() {
	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
			<header>
				<h1 className="text-[2rem] font-bold leading-10 text-text-primary">
					Design System
				</h1>
				<Note>
					Componentes base y tokens de Inventory Manager. Cada bloque muestra la
					intención además del render.
				</Note>
			</header>

			<Section index={1} title="Paleta de color">
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
					{palette.map(({ token, swatch }) => (
						<div
							key={token}
							className="flex items-center gap-3 rounded-md border border-border p-2"
						>
							<span
								aria-hidden="true"
								className={cn(
									"size-10 shrink-0 rounded-sm border border-border",
									swatch,
								)}
							/>
							<div className="min-w-0">
								<p className="truncate text-sm font-medium text-text-primary">
									{token}
								</p>
								<p className="text-xs text-text-muted">{designTokens[token]}</p>
							</div>
						</div>
					))}
				</div>
			</Section>

			<Section index={2} title="Tipografía — Inter">
				<div className="flex flex-col gap-4">
					{typeScale.map((item) => (
						<div
							key={item.spec}
							className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0"
						>
							<p className="text-xs text-text-muted">{item.spec}</p>
							<p className={cn("text-text-primary", item.className)}>
								{item.sample}
							</p>
						</div>
					))}
				</div>
			</Section>

			<Section index={3} title="Botones">
				<div className="flex flex-wrap items-center gap-3">
					<Button size="ds" variant="primary">
						Guardar
					</Button>
					<Button size="ds" variant="secondary">
						Cancelar
					</Button>
					<Button size="ds" variant="ghost">
						Ver detalles
					</Button>
					<Button size="ds" variant="danger">
						Eliminar
					</Button>
					<Button size="ds" disabled>
						Sin stock
					</Button>
				</div>
				<div className="mt-4">
					<Note>
						Alto 48px, radio 8px, texto Bold 14px. Solo un primary por vista.
					</Note>
				</div>
			</Section>

			<Section index={4} title="Badges de estado de stock">
				<div className="flex flex-wrap items-center gap-3">
					{Object.entries(stockStatus).map(([status]) => (
						<StockBadge key={status} status={status as StockStatus} />
					))}
				</div>
				<div className="mt-4">
					<Note>El estado siempre se comunica con texto además del color.</Note>
				</div>
			</Section>

			<Section index={5} title="Campos de formulario">
				<div className="grid gap-6 sm:grid-cols-2">
					<TextField
						label="Nombre del producto"
						name="nombre"
						hint="Máximo 120 caracteres"
					/>
					<TextField
						label="Nombre del producto (en foco)"
						name="nombre-foco"
						autoFocus
					/>
					<TextField
						label="Email"
						name="email"
						error="Ingresá un email válido"
					/>
					<SelectField
						label="Categoría"
						name="categoria"
						placeholder="Seleccionar categoría"
						options={[
							{ value: "electronica", label: "Electrónica" },
							{ value: "indumentaria", label: "Indumentaria" },
							{ value: "hogar", label: "Hogar" },
						]}
					/>
				</div>
				<div className="mt-4">
					<Note>
						En foco: borde primario 2px (border + ring, sin shift de layout).
					</Note>
				</div>
			</Section>

			<Section index={6} title="Tarjetas KPI">
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<KpiCard
						label="Total de productos"
						value="1.248"
						delta={{ value: "4,2%", direction: "up" }}
					/>
					<KpiCard
						label="Valor del inventario"
						value="$ 84.320"
						delta={{ value: "1,8%", direction: "up" }}
					/>
					<KpiCard
						label="Productos con stock bajo"
						value={12}
						tone="alert"
						note="Requieren reposición"
					/>
					<KpiCard
						label="Movimientos de hoy"
						value={37}
						delta={{ value: "2,1%", direction: "down" }}
					/>
				</div>
			</Section>

			<Section index={7} title="Alertas de stock bajo">
				<div className="flex flex-col gap-3">
					<Alert
						variant="warning"
						title="12 productos por debajo del umbral mínimo"
					>
						Revisá el stock y generá una orden de reposición.
					</Alert>
					<Alert variant="danger" title="3 productos agotados">
						Sin unidades disponibles para la venta.
					</Alert>
					<Alert variant="success" title="Entrada registrada">
						El ingreso de mercadería se guardó correctamente.
					</Alert>
				</div>
			</Section>

			<Section index={8} title="Tabla de datos (densa)">
				<DataTable
					columns={productColumns}
					rows={productRows}
					getRowKey={(row) => row.sku}
				/>
			</Section>
		</main>
	);
}
