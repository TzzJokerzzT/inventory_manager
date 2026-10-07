import type { StockStatus } from "@/components/design-system";

/**
 * Sample dashboard data for MI-20 U2.
 *
 * Decision 3 (mixed data): the active company is real (it comes from
 * `GET /companies`), but the KPIs, stock alerts and table rows do not exist in
 * the API yet — they need products (MI-6/MI-7) and movements (MI-9). They live
 * here as declared sample data, and the view always shows a visible "Datos de
 * muestra" notice so they are never mistaken for real data. The day MI-6/MI-9
 * land, this module is replaced, not the view.
 */

export type DashboardKpi = {
	id: string;
	label: string;
	value: string | number;
	delta?: {
		value: string;
		direction: "up" | "down";
		caption?: string;
	};
	note?: string;
	tone?: "default" | "alert";
};

export const dashboardKpis: DashboardKpi[] = [
	{
		id: "total-products",
		label: "Total de productos",
		value: "1.248",
		delta: { value: "4,2%", direction: "up" },
	},
	{
		id: "inventory-value",
		label: "Valor del inventario",
		value: "$ 84.320",
		delta: { value: "1,8%", direction: "up" },
	},
	{
		id: "low-stock",
		label: "Productos con stock bajo",
		value: 12,
		tone: "alert",
		note: "Requieren reposición",
	},
	{
		id: "movements-today",
		label: "Movimientos de hoy",
		value: 37,
		delta: { value: "2,1%", direction: "down" },
	},
];

export type StockAlert = {
	id: string;
	variant: "warning" | "danger";
	title: string;
	description: string;
};

export const stockAlerts: StockAlert[] = [
	{
		id: "below-threshold",
		variant: "warning",
		title: "12 productos por debajo del umbral mínimo",
		description: "Revisá el stock y generá una orden de reposición.",
	},
	{
		id: "out-of-stock",
		variant: "danger",
		title: "3 productos agotados",
		description: "Sin unidades disponibles para la venta.",
	},
];

export type StockRow = {
	name: string;
	sku: string;
	category: string;
	price: string;
	units: number;
	status: StockStatus;
};

export const stockTableRows: StockRow[] = [
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
