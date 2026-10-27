import type { Metadata } from "next";
import { CategoryCreateView } from "@/src/view/Dashboard/category-create-view";

export const metadata: Metadata = {
	title: "Nueva categoría — Inventory Manager",
	description:
		"Cargá una categoría para clasificar los productos de tu empresa y encontrarlos más rápido en el catálogo.",
};

export default function CategoryCreatePage() {
	return <CategoryCreateView />;
}
