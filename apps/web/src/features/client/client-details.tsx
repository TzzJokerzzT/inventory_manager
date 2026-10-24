"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { useActiveCompany } from "../company/store/company-selectors";
import { useCustomer } from "./api/use-customer";
import { CustomerDetailPanel } from "./components/customer-detail-panel";

const LIST_HREF = "/dashboard/clients";
const LOAD_ERROR_FALLBACK = "Probá de nuevo en unos segundos.";

/**
 * The detail page for one customer (`/dashboard/clients/[id]/details`).
 *
 * The read-only detail used to be a panel inside the list, fed by the row the
 * person clicked. As a page it needs its own read: a reload has to work, and the
 * link has to be shareable. It reads with `useCustomer` — the same hook the edit
 * route uses — so a customer deleted in another tab answers the readable 404
 * instead of an empty page.
 *
 * The sales table is the existing `CustomerDetailPanel`, unchanged: it already
 * reads its own movements by `customerId`.
 */
export function ClientDetails({ customerId }: { customerId: string }) {
	const router = useRouter();
	const company = useActiveCompany();
	const companyId = company?.id;
	const detail = useCustomer(companyId, customerId);

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
						Detalles del cliente
					</h1>
					<p className="mt-1 text-sm text-text-secondary">
						Los campos marcados con * son obligatorios
					</p>
				</div>
				<Link href={LIST_HREF} className="w-full sm:w-auto">
					<Button variant="outline" className="h-12 w-full sm:w-auto">
						<ArrowLeft className="mr-2 size-5" />
						Volver al listado de clientes
					</Button>
				</Link>
			</header>

			{companyId === undefined ? (
				<Alert variant="danger" title="No hay una empresa activa">
					Elegí una empresa en el selector para ver sus clientes.
				</Alert>
			) : detail.isPending ? (
				<div className="flex justify-center p-8">
					<SpinnerMotion />
				</div>
			) : detail.isError ? (
				<div className="flex flex-col gap-3">
					<Alert variant="danger" title="No pudimos cargar el cliente">
						{detail.error instanceof ApiError
							? detail.error.message
							: LOAD_ERROR_FALLBACK}
					</Alert>
					<div className="flex justify-end">
						<Button
							type="button"
							variant="outline"
							className="h-10 w-full sm:w-40"
							onClick={() => router.push(LIST_HREF)}
						>
							Volver a clientes
						</Button>
					</div>
				</div>
			) : detail.data ? (
				<CustomerDetailPanel companyId={companyId} customer={detail.data} />
			) : null}
		</LazyMotionTag>
	);
}
