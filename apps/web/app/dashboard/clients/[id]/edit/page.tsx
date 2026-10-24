import type { Metadata } from "next";
import { ClientEditView } from "@/src/view/Dashboard/client-edit-view";

export const metadata: Metadata = {
	title: "Editar cliente — Inventory Manager",
	description:
		"Actualizá el nombre y los datos de contacto de un cliente de tu empresa.",
};

export default async function EditClientPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return <ClientEditView customerId={id} />;
}
