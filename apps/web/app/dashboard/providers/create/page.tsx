import type { Metadata } from "next";
import { ProviderCreateView } from "@/src/view/Dashboard/provider-create-view";

export const metadata: Metadata = {
	title: "Nuevo proveedor — Inventory Manager",
	description:
		"Cargá un proveedor de tu empresa para registrarle compras por medida y comparar a qué precio te llega cada lote.",
};

export default function ProviderCreatePage() {
	return <ProviderCreateView />;
}
