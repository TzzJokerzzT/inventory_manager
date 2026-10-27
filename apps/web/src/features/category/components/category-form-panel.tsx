"use client";

import type { Category } from "@/lib/api/schemas";
import { CategoryForm } from "./category-form";

/**
 * The panel the write page opens for both flows.
 *
 * Unlike the customers panel it needs no read: the contract exposes no
 * per-category endpoint, so edit mode starts from the row the list already has
 * (`category`). That also means the panel never shows a spinner — there is
 * nothing in flight — and a category deleted from another tab surfaces as the
 * `404 category_not_found` of the patch itself, translated inside the form.
 */
export function CategoryFormPanel({
	companyId,
	category,
	onDone,
}: {
	companyId: string;
	category?: Category;
	onDone: () => void;
}) {
	const isEdit = category !== undefined;

	return (
		<section
			aria-label={isEdit ? "Editar categoría" : "Nueva categoría"}
			data-slot="category-form-panel"
			className="flex w-full min-w-0 flex-col gap-4 rounded-xl border bg-surface p-4 sm:p-6"
		>
			<h2 className="text-lg font-bold text-text-primary">
				{isEdit ? "Editar categoría" : "Nueva categoría"}
			</h2>

			<CategoryForm
				// React's own way to reset state: changing the key remounts the form.
				// The panel stays mounted while the route changes, so without this a
				// save would keep the previous row's name in the fields.
				key={category?.id ?? "new"}
				companyId={companyId}
				category={category}
				onSaved={onDone}
				onCancel={onDone}
			/>
		</section>
	);
}
