import type { Metadata } from "next";
import { ClientDetailsView } from "@/src/view/Dashboard/client-details-view";

export const metadata: Metadata = {
	title: "Detalle del cliente — Inventory Manager",
	description:
		"Datos de contacto del cliente y el historial de salidas asociadas a su cuenta.",
};

export default async function ClientDetailsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return <ClientDetailsView customerId={id} />;
}
