import type { Metadata } from "next";
import { MovementView } from "@/src/view/Dashboard/movement-view";

export const metadata: Metadata = {
	title: "Movimientos — Inventory Manager",
	description:
		"Panel de control de tus movimientos en el inventario donde puedes registrar entradas y salidas de tus productos.",
};

export default function MovementPage() {
	return <MovementView />;
}
