import type { Metadata } from "next";
import { ProviderEditView } from "@/src/view/Dashboard/provider-edit-view";

export const metadata: Metadata = {
	title: "Editar proveedor — Inventory Manager",
	description:
		"Corregí el nombre y el contacto de un proveedor de tu empresa sin tocar las compras que ya le registraste.",
};

export default async function ProviderEditPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return <ProviderEditView providerId={id} />;
}
