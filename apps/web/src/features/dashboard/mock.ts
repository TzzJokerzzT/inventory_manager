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

// ===========================================
// Dashboard Mock Data
// ===========================================

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

// ===========================================
// Movements Mock Data
// ===========================================

export type movementRow = {
	date: string;
	type: "Entrada" | "Salida";
	product: string;
	quantity: number;
	user: string;
};
export function formatDate(date: Date | string | number) {
	const d = new Date(date);
	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const year = d.getFullYear();
	return `${day}-${month}-${year}`;
}

export const movementTableRows: movementRow[] = [
	{
		date: formatDate(new Date()),
		type: "Entrada",
		product: "Cable HDMI 2.1 x 3 mts",
		quantity: 10,
		user: "Alexis",
	},
];

// ===========================================
// Products Mock Data
// ===========================================

export type Product = {
	id: string;
	name: string;
	sku: string;
	category: string;
	price: number;
	stock: number;
	lowStockThreshold: number;
	description: string;
};

export const products: Product[] = [
	{
		id: "1",
		name: "Cable HDMI 2.1 x 3 m",
		sku: "CH-4856931",
		category: "tecnologia",
		price: 35000,
		stock: 120,
		lowStockThreshold: 20,
		description:
			"Cable HDMI 2.1 de alta velocidad, soporta 8K a 60 Hz y 4K a 120 Hz.",
	},
	{
		id: "2",
		name: "Portátil Lenovo IdeaPad 15 pulgadas",
		sku: "PC-1029384",
		category: "computadores",
		price: 2450000,
		stock: 14,
		lowStockThreshold: 5,
		description:
			"Portátil con procesador Ryzen 5, 16 GB de RAM y SSD de 512 GB.",
	},
	{
		id: "3",
		name: "Router Wi-Fi 6 AX3000",
		sku: "RD-5503821",
		category: "redes",
		price: 289000,
		stock: 32,
		lowStockThreshold: 10,
		description:
			"Router de doble banda Wi-Fi 6 con cuatro antenas y puertos Gigabit.",
	},
	{
		id: "4",
		name: "Teclado mecánico RGB",
		sku: "GM-7741026",
		category: "gamer",
		price: 210000,
		stock: 45,
		lowStockThreshold: 10,
		description:
			"Teclado mecánico con switches rojos, iluminación RGB y reposamuñecas.",
	},
	{
		id: "5",
		name: "Aspiradora robot inteligente",
		sku: "HG-3396157",
		category: "hogar",
		price: 799000,
		stock: 9,
		lowStockThreshold: 3,
		description:
			"Aspiradora robot con mapeo láser, control por app y base de autovaciado.",
	},
	{
		id: "6",
		name: "Auriculares Bluetooth con cancelación de ruido",
		sku: "TC-2284715",
		category: "tecnologia",
		price: 349000,
		stock: 60,
		lowStockThreshold: 15,
		description:
			"Auriculares inalámbricos con ANC y hasta 30 horas de batería.",
	},
	{
		id: "7",
		name: "Monitor 27 pulgadas 144 Hz",
		sku: "PC-8812409",
		category: "computadores",
		price: 899000,
		stock: 18,
		lowStockThreshold: 5,
		description:
			"Monitor IPS QHD de 27 pulgadas con 144 Hz y tiempo de respuesta de 1 ms.",
	},
	{
		id: "8",
		name: "Switch de red 8 puertos Gigabit",
		sku: "RD-6650348",
		category: "redes",
		price: 119000,
		stock: 4,
		lowStockThreshold: 8,
		description:
			"Switch no administrable de 8 puertos Gigabit con carcasa metálica.",
	},
	{
		id: "9",
		name: "Mouse gamer inalámbrico 26000 DPI",
		sku: "GM-4410593",
		category: "gamer",
		price: 185000,
		stock: 70,
		lowStockThreshold: 20,
		description:
			"Mouse ligero de 58 g con sensor óptico de 26000 DPI y batería de 70 horas.",
	},
	{
		id: "10",
		name: "Lámpara LED inteligente Wi-Fi",
		sku: "HG-9027764",
		category: "hogar",
		price: 59000,
		stock: 0,
		lowStockThreshold: 10,
		description: "Bombilla LED multicolor compatible con Alexa y Google Home.",
	},
];

// ===========================================
// Customer Mock Data
// ===========================================

export type CustomerRow = {
	id: string;
	name: string;
	phone: string;
	purchases: number;
	totalSpent: number; // COP
};

export const customers: CustomerRow[] = [
	{
		id: "1",
		name: "Carlos Andrés Rodríguez",
		phone: "+57 300 123 4567",
		purchases: 12,
		totalSpent: 4850000,
	},
	{
		id: "2",
		name: "María Fernanda López",
		phone: "+57 310 234 5678",
		purchases: 8,
		totalSpent: 2975000,
	},
	{
		id: "3",
		name: "Juan Sebastián Pérez",
		phone: "+57 311 345 6789",
		purchases: 15,
		totalSpent: 7320000,
	},
	{
		id: "4",
		name: "Laura Valentina Gómez",
		phone: "+57 312 456 7890",
		purchases: 3,
		totalSpent: 689000,
	},
	{
		id: "5",
		name: "Andrés Felipe Martínez",
		phone: "+57 313 567 8901",
		purchases: 21,
		totalSpent: 11450000,
	},
	{
		id: "6",
		name: "Daniela Carolina Herrera",
		phone: "+57 314 678 9012",
		purchases: 6,
		totalSpent: 1830000,
	},
	{
		id: "7",
		name: "Santiago Esteban Castro",
		phone: "+57 315 789 0123",
		purchases: 1,
		totalSpent: 289000,
	},
	{
		id: "8",
		name: "Paola Andrea Vargas",
		phone: "+57 316 890 1234",
		purchases: 10,
		totalSpent: 3640000,
	},
	{
		id: "9",
		name: "Miguel Ángel Torres",
		phone: "+57 317 901 2345",
		purchases: 18,
		totalSpent: 9210000,
	},
	{
		id: "10",
		name: "Camila Alejandra Ruiz",
		phone: "+57 318 012 3456",
		purchases: 4,
		totalSpent: 1175000,
	},
];
