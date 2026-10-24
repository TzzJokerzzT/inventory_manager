"use client";

import type { Supplier } from "@/lib/api/schemas";
import { ProviderForm } from "./provider-form";

/**
 * The inline panel the roster opens for both writing flows.
 *
 * Unlike the customers panel it needs no read: the contract exposes no
 * per-supplier endpoint, so edit mode starts from the row the list already has
 * (`provider`). That also means the panel never shows a spinner — there is
 * nothing in flight — and a supplier deleted from another tab surfaces as the
 * `404 supplier_not_found` of the patch itself, translated inside the form.
 */
export function ProviderFormPanel({
	companyId,
	provider,
	onDone,
}: {
	companyId: string;
	provider?: Supplier;
	onDone: () => void;
}) {
	const isEdit = provider !== undefined;

	return (
		<section
			aria-label={isEdit ? "Editar proveedor" : "Nuevo proveedor"}
			data-slot="provider-form-panel"
			className="flex w-full min-w-0 flex-col gap-4 rounded-xl border bg-surface p-4 sm:p-6"
		>
			<h2 className="text-lg font-bold text-text-primary">
				{isEdit ? "Editar proveedor" : "Nuevo proveedor"}
			</h2>

			<ProviderForm
				// React's own way to reset state: changing the key remounts the form.
				// The panel stays mounted while the selected supplier changes, so
				// without this the fields keep the previous row's values and a save
				// could write them onto another supplier (or create one from them).
				key={provider?.id ?? "new"}
				companyId={companyId}
				provider={provider}
				onSaved={onDone}
				onCancel={onDone}
			/>
		</section>
	);
}
