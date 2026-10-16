"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
	DropzoneField,
	SelectField,
	TextareaField,
	TextField,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { LazyMotionTag } from "@/src/shared/components/Animation";

const categories = [
	{ value: "tecnologia", label: "Tecnologia" },
	{ value: "computadores", label: "Computadores" },
	{ value: "redes", label: "Redes" },
	{ value: "gamer", label: "Gamer" },
	{ value: "hogar", label: "Hogar" },
];

export function CreateProduct() {
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
						Productos
					</h1>
					<p className="mt-1 text-sm text-text-secondary">
						Los campos marcados con * son obligatorios
					</p>
				</div>
				<Link href="/dashboard/products" className="w-full sm:w-auto">
					<Button variant="outline" className="h-12 w-full sm:w-auto">
						<ArrowLeft className="mr-2 size-5" />
						Volver a productos
					</Button>
				</Link>
			</header>

			<Divider />

			<section
				aria-label="Formulario de creación"
				className="flex w-full justify-center lg:min-h-[calc(100vh-15rem)] lg:items-center"
			>
				<form className="grid w-full min-w-0 max-w-3xl grid-cols-1 gap-4 rounded-xl border bg-surface p-4 sm:grid-cols-2 sm:p-6">
					<TextField
						label="Nombre del producto *"
						type="text"
						name="name"
						placeholder="Cable HDMI 2.1 x 3 m"
						autoComplete="off"
						className="sm:col-span-2"
					/>
					<TextField
						label="Código SKU *"
						type="text"
						name="sku"
						placeholder="CH-4856931"
						autoComplete="off"
					/>

					<SelectField
						label="Categoría"
						options={categories}
						name="category"
						placeholder="Busca o selecciona una categoría"
					/>

					<TextField
						label="Precio unitario *"
						type="number"
						name="price"
						placeholder="$10.0000"
					/>

					<TextField
						label="Umbral de stock bajo *"
						type="number"
						name="lowStockThreshold"
						placeholder="20"
					/>

					<TextareaField
						label="Descripción del producto *"
						name="description"
						placeholder="Coloque la descripción producto"
						autoComplete="off"
						className="sm:col-span-full"
					/>

					<DropzoneField
						name="photos"
						label="Foto del producto *"
						hint="Sube las fotos de tus productos"
						accept="jpg, png, webp"
						maxSize={5 * 1024 * 1024}
						multiple
						onFilesChange={(files) => console.log(files)}
						className="sm:col-span-full"
					/>

					<div className="col-span-full flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
						<Button className="h-10 w-full sm:w-30" variant="outline">
							Cancelar
						</Button>
						<Button className="h-10 w-full sm:w-30">Crear</Button>
					</div>
				</form>
			</section>
		</LazyMotionTag>
	);
}
