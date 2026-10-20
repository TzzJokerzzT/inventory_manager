import type { Metadata } from "next";
import { EditProduct } from "@/src/features/product/product-edit";

export const metadata: Metadata = {
	title: "Editar producto — Inventory Manager",
	description:
		"Editá el nombre, el SKU, el precio, la descripción y la foto de un producto de tu empresa.",
};

export default async function EditProductPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return <EditProduct productId={id} />;
}
