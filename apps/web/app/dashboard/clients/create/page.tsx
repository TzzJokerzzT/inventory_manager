import type { Metadata } from "next";
import { ClientCreateView } from "@/src/view/Dashboard/client-create-view";

export const metadata: Metadata = {
	title: "Nuevo cliente — Inventory Manager",
	description:
		"Cargá el nombre y los datos de contacto de un cliente de tu empresa.",
};

export default function CreateClientPage() {
	return <ClientCreateView />;
}
