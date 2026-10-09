"use client";

import {
	DropzoneField,
	SelectField,
	TextareaField,
	TextField,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { LazyMotionTag } from "@/src/shared/components/Animation";

export function CreateProduct() {
	const categories = [
		{ value: "tecnologia", label: "Tecnologia" },
		{ value: "computadores", label: "Computadores" },
		{ value: "redes", label: "Redes" },
		{ value: "gamer", label: "Gamer" },
		{ value: "hogar", label: "Hogar" },
	];
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
					<h1 className="text-2xl font-bold text-text-primary">Productos</h1>
					<p className="mt-1 text-sm text-text-secondary">
						Los campos marcados con * son obligatorios
					</p>
				</div>
			</header>

			<div className="w-full border border-sidebar-border"></div>

			<section
				aria-label="Formulario de creación"
				className="flex items-center justify-center gap-3"
			>
				<form className="grid w-full p-4 max-w-3xl min-w-0 grid-cols-1 gap-4 bg-surface border rounded-xl sm:grid-cols-2">
					<TextField
						label="Nombre del producto *"
						type="text"
						name="productSearch"
						placeholder="Cable HDMI 2.1 x 3 m"
						autoComplete="text"
						className="sm:col-span-2"
					/>
					<TextField
						label="Código SKU *"
						type="text"
						name="productSearch"
						placeholder="CH-4856931"
						autoComplete="text"
					/>

					<SelectField
						label="Categoria"
						options={categories}
						name="productSearch"
						placeholder="Selecciona una o varias categorias"
						autoComplete="text"
					/>

					<TextField
						label="Precio unitario *"
						type="number"
						name="productSearch"
						placeholder="$10.0000"
					/>

					<TextField
						label="Umbral de stock bajo *"
						type="number"
						name="productSearch"
						placeholder="20"
					/>

					<TextareaField
						label="Descripción del producto *"
						name="productSearch"
						placeholder="Coloque la descripción producto"
						autoComplete="text"
						className="sm:col-span-full"
					/>

					<DropzoneField
						name="documentos"
						label="Foto del producto *"
						hint="Sube las fotos de tus productos"
						accept="jpg, png, webp"
						maxSize={5 * 1024 * 1024}
						multiple
						onFilesChange={(files) => console.log(files)}
						className="sm:col-span-full"
					/>

					<div className="col-span-full flex justify-end gap-4">
						<Button className="h-10 w-30" variant="outline">
							Cancelar
						</Button>
						<Button className="h-10 w-30">Crear</Button>
					</div>
				</form>
			</section>
		</LazyMotionTag>
	);
}
