import type { Metadata } from "next";
import { ProductCreateView } from "@/src/view/Dashboard/product-create-view";

export const metadata: Metadata = {
	title: "Crear Productos — Inventory Manager",
	description:
		"Panel de control de tus productosde donde puedes crear, editar y/o eliminar los productos de tu empresa.",
};

export default function CreateProduct() {
	return <ProductCreateView />;
}
