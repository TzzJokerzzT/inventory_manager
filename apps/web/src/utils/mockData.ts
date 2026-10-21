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
	{
		id: "11",
		name: "Webcam Full HD 1080p con micrófono",
		sku: "CP-4410238",
		category: "computación",
		price: 129000,
		stock: 24,
		lowStockThreshold: 8,
		description:
			"Cámara web con enfoque automático y micrófono integrado con reducción de ruido.",
	},
	{
		id: "12",
		name: "Disco sólido SSD NVMe 1 TB",
		sku: "CP-5521907",
		category: "computación",
		price: 289000,
		stock: 15,
		lowStockThreshold: 10,
		description:
			"Unidad de estado sólido M.2 con velocidades de lectura de hasta 3.500 MB/s.",
	},
	{
		id: "13",
		name: "Parlante Bluetooth portátil resistente al agua",
		sku: "AU-7731045",
		category: "audio",
		price: 169000,
		stock: 32,
		lowStockThreshold: 10,
		description: "Parlante con certificación IPX7 y hasta 12 horas de batería.",
	},
	{
		id: "14",
		name: "Barra de sonido 2.1 con subwoofer",
		sku: "AU-7782316",
		category: "audio",
		price: 459000,
		stock: 6,
		lowStockThreshold: 8,
		description:
			"Barra de sonido con conexión HDMI ARC, Bluetooth y subwoofer inalámbrico.",
	},
	{
		id: "15",
		name: "Silla gamer ergonómica reclinable",
		sku: "GM-3309871",
		category: "gaming",
		price: 689000,
		stock: 9,
		lowStockThreshold: 5,
		description:
			"Silla con soporte lumbar, reposabrazos 4D y reclinación hasta 155°.",
	},
	{
		id: "16",
		name: "Control inalámbrico para consola",
		sku: "GM-3345502",
		category: "gaming",
		price: 219000,
		stock: 0,
		lowStockThreshold: 10,
		description:
			"Control con vibración háptica, batería recargable y conexión Bluetooth.",
	},
	{
		id: "17",
		name: "Cámara de seguridad Wi-Fi 360°",
		sku: "HG-9034418",
		category: "hogar",
		price: 139000,
		stock: 18,
		lowStockThreshold: 10,
		description:
			"Cámara giratoria con visión nocturna, detección de movimiento y audio bidireccional.",
	},
	{
		id: "18",
		name: "Enchufe inteligente Wi-Fi 16 A",
		sku: "HG-9041126",
		category: "hogar",
		price: 45000,
		stock: 40,
		lowStockThreshold: 15,
		description:
			"Enchufe programable con control por app, compatible con Alexa y Google Home.",
	},
	{
		id: "19",
		name: "Cafetera de cápsulas automática",
		sku: "HG-9058873",
		category: "hogar",
		price: 349000,
		stock: 7,
		lowStockThreshold: 8,
		description:
			"Cafetera con presión de 19 bares y depósito extraíble de 0,8 litros.",
	},
	{
		id: "20",
		name: "Freidora de aire digital 5 litros",
		sku: "HG-9066209",
		category: "hogar",
		price: 399000,
		stock: 12,
		lowStockThreshold: 6,
		description:
			"Freidora sin aceite con pantalla táctil y 8 programas preestablecidos.",
	},
	{
		id: "21",
		name: "Repetidor Wi-Fi 6 doble banda",
		sku: "RD-2210764",
		category: "redes",
		price: 149000,
		stock: 21,
		lowStockThreshold: 10,
		description:
			"Extensor de señal AX1800 con puerto Gigabit y configuración por app.",
	},
	{
		id: "22",
		name: "Cable de red Cat 6 de 10 m",
		sku: "RD-2234981",
		category: "redes",
		price: 29000,
		stock: 60,
		lowStockThreshold: 20,
		description:
			"Cable Ethernet blindado con conectores RJ45 y velocidad de hasta 1 Gbps.",
	},
	{
		id: "23",
		name: "Hub USB-C 7 en 1",
		sku: "AC-6612047",
		category: "accesorios",
		price: 159000,
		stock: 4,
		lowStockThreshold: 10,
		description:
			"Adaptador con HDMI 4K, lector de tarjetas, 2 puertos USB-A y carga de 100 W.",
	},
	{
		id: "24",
		name: "Soporte ajustable para portátil",
		sku: "AC-6628390",
		category: "accesorios",
		price: 89000,
		stock: 0,
		lowStockThreshold: 8,
		description: "Base de aluminio plegable con altura y ángulo regulables.",
	},
	{
		id: "25",
		name: "Tablet 10,4 pulgadas 128 GB",
		sku: "CP-4467325",
		category: "computación",
		price: 899000,
		stock: 11,
		lowStockThreshold: 5,
		description: "Tablet con pantalla 2K, 6 GB de RAM y batería de 7.040 mAh.",
	},
];
