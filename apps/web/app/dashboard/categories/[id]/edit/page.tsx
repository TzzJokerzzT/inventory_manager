import type { Metadata } from "next";
import { CategoryEditView } from "@/src/view/Dashboard/category-edit-view";

export const metadata: Metadata = {
	title: "Editar categoría — Inventory Manager",
	description:
		"Renombrá una categoría de tu empresa sin tocar los productos que ya la tienen asignada.",
};

export default async function CategoryEditPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return <CategoryEditView categoryId={id} />;
}
