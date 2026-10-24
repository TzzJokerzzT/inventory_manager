"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { useActiveCompany } from "../company/store/company-selectors";
import { useProviders } from "./api/use-providers";
import { ProviderFormPanel } from "./components/provider-form-panel";

const LIST_HREF = "/dashboard/providers";

/** The API has no per-supplier read, so an absent id means "not in the roster". */
const NOT_FOUND = "Ese proveedor ya no existe en esta empresa.";

/**
 * The write page for suppliers (`/dashboard/providers/create` and
 * `/dashboard/providers/[id]/edit`).
 *
 * The form itself is the one the roster used inline; what changed is who
 * resolves the supplier. There is **no `GET /suppliers/{id}`** in the contract,
 * so edit mode resolves the id against the roster the list already reads: that
 * response is cached by react-query, already ordered, and is the only place the
 * data lives. An id that is not there was deleted in another tab, and it says so
 * instead of rendering an empty form that would create a duplicate.
 */
export function ProviderWrite({ providerId }: { providerId?: string }) {
	const router = useRouter();
	const company = useActiveCompany();
	const companyId = company?.id;
	const providers = useProviders(companyId);
	const isEdit = providerId !== undefined;
	const provider = isEdit
		? (providers.data ?? []).find((row) => row.id === providerId)
		: undefined;

	return (
		<LazyMotionTag
			tag="div"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4 sm:gap-6"
		>
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<h1 className="text-xl font-bold text-text-primary sm:text-2xl">
						{isEdit ? "Editar proveedor" : "Nuevo proveedor"}
					</h1>
					<p className="mt-1 text-sm text-text-secondary">
						Los campos marcados con * son obligatorios
					</p>
				</div>
				<Link
					href={LIST_HREF}
					className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium whitespace-nowrap transition-all select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:w-auto"
				>
					<ArrowLeft aria-hidden="true" className="size-5" />
					Volver a proveedores
				</Link>
			</header>

			{companyId === undefined ? (
				<Alert variant="danger" title="No hay una empresa activa">
					Elegí una empresa en el selector para gestionar sus proveedores.
				</Alert>
			) : providers.isPending ? (
				<div className="flex justify-center p-8">
					<SpinnerMotion />
				</div>
			) : isEdit && provider === undefined ? (
				<div className="flex flex-col gap-3">
					<Alert variant="danger" title="No pudimos cargar el proveedor">
						{NOT_FOUND}
					</Alert>
					<div className="flex justify-end">
						<Button
							type="button"
							variant="outline"
							className="h-10 w-full sm:w-40"
							onClick={() => router.push(LIST_HREF)}
						>
							Volver a proveedores
						</Button>
					</div>
				</div>
			) : (
				<ProviderFormPanel
					companyId={companyId}
					provider={provider}
					onDone={() => router.push(LIST_HREF)}
				/>
			)}
		</LazyMotionTag>
	);
}
