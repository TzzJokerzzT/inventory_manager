import type { Metadata } from "next";
import { CategoriesView } from "@/src/view/Dashboard/categories-view";

export const metadata: Metadata = {
	title: "Categorías — Inventory Manager",
	description:
		"Catálogo de categorías de tu empresa: creá, renombrá y dá de baja las categorías con las que clasificás tus productos.",
};

export default function CategoriesPage() {
	return <CategoriesView />;
}
