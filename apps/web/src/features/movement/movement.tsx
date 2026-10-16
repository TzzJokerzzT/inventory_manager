"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { DataTable } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { movementColumns } from "@/src/utils/Columns";
import { movementTableRows, products } from "@/src/utils/mockData";
import { MovementEntryStockForm } from "./movement-stock-entry-form";
import { MovementOutStockForm } from "./movement-stock-out-form";

const productsOptions = products.map((product) => ({
	value: product.sku,
	label: product.name,
}));

export function Movement() {
	const [isEntry, setIsEntry] = useState<boolean>(true);

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
					>
						<div className="flex flex-col gap-3">
							<h1 className="text-2xl font-bold text-text-primary">
								Entrada de productos
							</h1>
							<MovementEntryStockForm options={productsOptions} />
						</div>
					</motion.div>
				) : (
					<motion.div
						key="salida"
						initial={{ opacity: 0, x: 10 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.5 }}
					>
						<div className="flex flex-col gap-3">
							<h1 className="text-2xl font-bold text-text-primary">
								Salida de productos
							</h1>
							<MovementOutStockForm options={productsOptions} />
						</div>
					</motion.div>
				)}

				{/* La tabla scrollea horizontalmente en pantallas chicas en vez de
				    desbordar la página. */}
				<div className="min-w-0 overflow-x-auto rounded-xl">
					<div className="min-w-[36rem]">
						<DataTable
							columns={movementColumns}
							rows={movementTableRows}
							getRowKey={(row) => row.product}
						/>
					</div>
				</div>
			</section>
		</LazyMotionTag>
	);
}
