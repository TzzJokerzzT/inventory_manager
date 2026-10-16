import {
	AutoComplete,
	TextareaField,
	TextField,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";

export type ProductsOption = {
	label: string;
	value: string;
};

export type MovementOutStockFormProps = {
	options: ProductsOption[];
};

export function MovementOutStockForm({ options }: MovementOutStockFormProps) {
	return (
		<form className="grid w-full min-w-0 grid-cols-1 gap-4 rounded-xl border bg-surface p-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
			<AutoComplete
				label="Productos"
				options={options}
				name="product"
				placeholder="Selecciona una o varias categorias"
				className="md:col-span-full xl:col-span-1 2xl:col-span-full"
			/>

			<TextField
				label="Cantidad *"
				type="number"
				name="quantity"
				placeholder="20"
			/>

			<TextField
				label="Motivo"
				type="text"
				name="reason"
				placeholder="Compra a proveedor"
				autoComplete="off"
			/>

			<TextField
				label="Proveedor o cliente (opcional)"
				type="text"
				name="counterparty"
				placeholder="Sin asociar"
				autoComplete="off"
				className="md:col-span-full xl:col-span-1 2xl:col-span-full"
			/>

			<TextareaField
				label="Nota"
				name="note"
				placeholder="Observaciones del movimiento..."
				autoComplete="off"
				className="md:col-span-full xl:col-span-1 2xl:col-span-full"
				size="h-20"
			/>

			<div className="col-span-full flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
				<Button className="h-10 w-full sm:w-30" variant="outline">
					Cancelar
				</Button>
				<Button className="h-10 w-full sm:w-30">Crear</Button>
			</div>
		</form>
	);
}
