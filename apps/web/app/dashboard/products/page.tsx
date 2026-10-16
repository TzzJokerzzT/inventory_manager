import type { Metadata } from "next";
import { ProductView } from "@/src/view/Dashboard/product-view";

export const metadata: Metadata = {
	title: "Productos — Inventory Manager",
	description:
		"Panel de control de tus productos de donde puedes crear, editar y/o eliminar los productos de tu empresa.",
};

export default function ProductPage() {
	return <ProductView />;
}
