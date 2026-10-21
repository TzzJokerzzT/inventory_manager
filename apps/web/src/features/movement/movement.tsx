"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Alert, DataTable } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { SectionTitle } from "@/src/shared/components/SectionTitle";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { useMovements } from "./api/use-movements";
import { movementColumns } from "./components/movement-columns";
import { MovementEntryStockForm } from "./movement-stock-entry-form";
import { MovementOutStockForm } from "./movement-stock-out-form";

const LOAD_ERROR_FALLBACK = "Probá de nuevo en unos segundos.";

const EMPTY_MESSAGE =
	"Todavía no registraste movimientos. Cargá la primera entrada con el formulario.";

/**
 * The stock movements view (MI-26).
 *
 * It reads the real history of the **active company**: `useActiveCompany()`
 * picks the company and `useMovements()` reads the movements newest first, with
 * the product and the actor already resolved by the API. The entry and exit
 * forms share one implementation and only differ in the `type` they send, which
 * is what makes the entry form an entry.
 *
 * The table refreshes by invalidation, not by local state: a successful
 * registration invalidates the history **and** the product catalogue, so the new
 * row appears and the stock shown elsewhere is right without a reload.
 */
export function Movement() {
	const company = useActiveCompany();
	const [isEntry, setIsEntry] = useState<boolean>(true);

	const companyId = company?.id;
	const movements = useMovements(companyId);
	const rows = movements.data ?? [];

	return (
		<LazyMotionTag
			tag="div"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="flex min-w-0 flex-col gap-4 sm:gap-6"
		>
			<ViewHeader
				title="Movimientos de inventario"
				subTitle="Registrá entradas y salidas; el stock se actualiza automáticamente."
			/>

			<section
				aria-label="Stock"
				className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:items-start"
			>
				<div className="xl:col-span-full">
					<ButtonGroup className="w-full sm:w-auto">
						<Button
							onClick={() => setIsEntry(true)}
							variant={isEntry ? "default" : "outline"}
							className="h-10 flex-1 sm:flex-none"
						>
							Entrada de stock
						</Button>
						<Button
							onClick={() => setIsEntry(false)}
							variant={!isEntry ? "default" : "outline"}
							className="h-10 flex-1 sm:flex-none"
						>
							Salida de stock
						</Button>
					</ButtonGroup>
				</div>

				{isEntry ? (
					<motion.div
						key="entrada"
						initial={{ opacity: 0, x: 10 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.5 }}
						className="xl:col-span-full"
					>
						<div className="flex flex-col gap-3">
							<h2 className="text-2xl font-bold text-text-primary">
								Entrada de productos
							</h2>
							<MovementEntryStockForm companyId={companyId} />
						</div>
					</motion.div>
				) : (
					<motion.div
						key="salida"
						initial={{ opacity: 0, x: 10 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.5 }}
						className="xl:col-span-full"
					>
						<div className="flex flex-col gap-3">
							<h2 className="text-2xl font-bold text-text-primary">
								Salida de productos
							</h2>
							<MovementOutStockForm companyId={companyId} />
						</div>
					</motion.div>
				)}

				<SectionTitle
					ariaLabel="Historial de movimientos"
					title="Historial"
					className="flex min-w-0 flex-col gap-3 xl:col-span-full"
				>
					{companyId === undefined ? (
						<p className="text-sm text-text-muted">
							Seleccioná una empresa para ver sus movimientos.
						</p>
					) : movements.isPending ? (
						<div className="flex justify-center p-8">
							<SpinnerMotion />
						</div>
					) : movements.isError ? (
						<Alert variant="danger" title="No pudimos cargar los movimientos">
							{movements.error instanceof ApiError
								? movements.error.message
								: LOAD_ERROR_FALLBACK}
						</Alert>
					) : (
						// La tabla scrollea horizontalmente en pantallas chicas en vez de
						// desbordar la página.
						<div className="min-w-0 overflow-x-auto rounded-xl">
							<div className="min-w-[36rem]">
								<DataTable
									columns={movementColumns}
									rows={rows}
									getRowKey={(row) => row.id}
									emptyMessage={EMPTY_MESSAGE}
								/>
							</div>
						</div>
					)}
				</SectionTitle>
			</section>
		</LazyMotionTag>
	);
}
