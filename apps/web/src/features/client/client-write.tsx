"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/design-system";
import { Divider } from "@/components/ui/divider";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { useActiveCompany } from "../company/store/company-selectors";
import { CustomerFormPanel } from "./components/customer-form-panel";

const LIST_HREF = "/dashboard/clients";

/**
 * The write page for a customer (`/dashboard/clients/create` and
 * `/dashboard/clients/[id]/edit`).
 *
 * It replaces the inline panel the list used to open: writing now has an
 * address, so a reload keeps the form, the browser's back button does the
 * obvious thing, and the list stops carrying two responsibilities.
 *
 * The form itself is the same one the panel rendered — `CustomerFormPanel`
 * already owns the edit read (spinner, `404 customer_not_found`) — so this
 * component only adds what a page needs: the way back and the company guard.
 * Both outcomes, saved or cancelled, return to the list.
 */
export function ClientWrite({ customerId }: { customerId?: string }) {
	const router = useRouter();
	const company = useActiveCompany();
	// The title follows the route: the edit page is not a "new customer" page.
	const isEdit = customerId !== undefined;

	return (
		<LazyMotionTag
			tag="div"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="flex min-w-0 flex-col gap-4 sm:gap-6"
		>
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<h1 className="text-xl font-bold text-text-primary sm:text-2xl">
						{isEdit ? "Editar cliente" : "Nuevo cliente"}
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
					Volver a clientes
				</Link>
			</header>

			<Divider />

			{company === undefined ? (
				<Alert variant="danger" title="No hay una empresa activa">
					Elegí una empresa en el selector para gestionar sus clientes.
				</Alert>
			) : (
				<CustomerFormPanel
					companyId={company.id}
					customerId={customerId}
					onDone={() => router.push(LIST_HREF)}
				/>
			)}
		</LazyMotionTag>
	);
}
