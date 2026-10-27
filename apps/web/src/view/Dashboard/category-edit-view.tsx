import { CategoryWrite } from "@/src/features/category/category-write";

export function CategoryEditView({ categoryId }: { categoryId: string }) {
	return <CategoryWrite categoryId={categoryId} />;
}
