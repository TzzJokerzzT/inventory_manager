import type { Metadata } from "next";
import { ProvidersView } from "@/src/view/Dashboard/providers-view";

export const metadata: Metadata = {
	title: "Proveedores — Inventory Manager",
	description:
		"Padrón de proveedores de tu empresa: a quién le comprás y a qué precio por medida llegó el último lote.",
};

export default function ProvidersPage() {
	return <ProvidersView />;
}
