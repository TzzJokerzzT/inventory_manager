"use client";

import {
	type Column,
	DataTable,
	SelectField,
	TextareaField,
	TextField,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import {
	type movementRow,
	movementTableRows,
	products,
} from "../dashboard/mock";

const movementColumns: Column<movementRow>[] = [
	{ key: "date", header: "Fecha" },
	{ key: "type", header: "Tipo" },
	{ key: "product", header: "Producto" },
	{ key: "quantity", header: "Cantidad" },
	{ key: "user", header: "Usuario" },
];

const productsOptions = products.map((product) => ({
	value: product.sku,
	label: product.name,
}));

export function Movement() {
	return (
		<LazyMotionTag
			tag="div"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="flex flex-col gap-6"
		>
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-text-primary">
						Movimientos de inventario
					</h1>
					<p className="mt-1 text-sm text-text-secondary">
						Registrá entradas y salidas; el stock se actualiza automáticamente.
					</p>
				</div>
			</header>

			<section
				aria-label="Stock"
				className="grid grid-cols-1 gap-3 sm:grid-cols-2"
			>
				<div className="col-span-full">
					<ButtonGroup>
						<Button variant="outline" className="h-10">
							Entrada de stock
						</Button>
						<Button variant="outline" className="h-10">
							Salida de stock
						</Button>
					</ButtonGroup>
				</div>
				<form className="grid w-full p-4 max-w-3xl min-w-0 grid-cols-1 gap-4 bg-surface border rounded-xl sm:grid-cols-2">
					<SelectField
						label="Productos"
						options={productsOptions}
						name="productSearch"
						placeholder="Selecciona una o varias categorias"
						autoComplete="text"
						className="sm:col-span-full"
					/>

					<TextField
						label="Cantidad *"
						type="number"
						name="productSearch"
						placeholder="20"
					/>

					<TextField
						label="Motivo"
						type="text"
						name="productSearch"
						placeholder="Compra a proveedor"
						autoComplete="text"
					/>

					<TextField
						label="Proveedor o cliente (opcional)"
						type="text"
						name="productSearch"
						placeholder="Sin asociar"
						autoComplete="text"
						className="sm:col-span-full"
					/>

					<TextareaField
						label="Nota"
						name="productSearch"
						placeholder="Observaciones del movimiento..."
						autoComplete="text"
						className="sm:col-span-full"
						size="h-20"
					/>

					<div className="col-span-full flex justify-end gap-4">
						<Button className="h-10 w-30" variant="outline">
							Cancelar
						</Button>
						<Button className="h-10 w-30">Crear</Button>
					</div>
				</form>

				<DataTable
					columns={movementColumns}
					rows={movementTableRows}
					getRowKey={(row) => row.product}
				/>
			</section>
		</LazyMotionTag>
	);
}
