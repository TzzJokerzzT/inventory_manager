"use client";

import { cn } from "cn";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { Alert, TextareaField, TextField } from "@/components/design-system";
import { Button, buttonVariants } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { Product } from "@/lib/api/schemas";
import { AlertToast } from "@/src/shared/components/AlertToast";
import { useCreateProduct } from "./api/use-create-product";
import { useUpdateProduct } from "./api/use-update-product";
import { useUploadProductPhoto } from "./api/use-upload-product-photo";
import { ProductPhotoField } from "./components/product-photo-field";
import {
	normalizePrice,
	normalizeSku,
	toNullableDescription,
	validateProduct,
	validateProductPhoto,
} from "./lib/validate-product";

const FALLBACK_ERROR = "No pudimos guardar el producto. Probá de nuevo.";
const PHOTO_FALLBACK_ERROR = "No pudimos subir la foto. Probá de nuevo.";

/**
 * Turns the API's machine-readable `code` into something a person can act on.
 * A code we do not know falls back to the server's message, which is already
 * user-facing.
 */
function saveErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		if (error.code === "sku_already_exists") {
			return "Ya existe un producto con ese SKU en esta empresa.";
		}
		if (error.code === "insufficient_role") {
			return "Tu rol no permite esta acción.";
		}
		if (error.code === "product_not_found") {
			return "Ese producto ya no existe en el catálogo.";
		}
		return error.message;
	}
	return error ? FALLBACK_ERROR : undefined;
}

/**
 * The product form (MI-25), in create and edit mode.
 *
 * One component for both because the fields, the validation and the photo flow
 * are the same: what changes is the product it starts from and the mutation it
 * calls. A product passed in means edit; nothing means create.
 *
 * Validation mirrors the API (name 1..120, sku 1..64, price as a decimal string
 * with up to two decimals, description ≤ 1000, photo ≤ 5 MiB and jpg/png/webp),
 * so an invalid body never reaches the server. The values are normalized before
 * sending — trimmed name, uppercased SKU, two decimals, `null` for an empty
 * description — because that is the shape the contract stores.
 */
export function ProductForm({
	companyId,
	product,
}: {
	companyId: string;
	product?: Product;
}) {
	const isEdit = product !== undefined;
	const router = useRouter();

	const [name, setName] = useState(product?.name ?? "");
	const [sku, setSku] = useState(product?.sku ?? "");
	const [price, setPrice] = useState(product?.price ?? "");
	const [description, setDescription] = useState(product?.description ?? "");
	const [photoUrl, setPhotoUrl] = useState<string | null>(
		product?.photoUrl ?? null,
	);
	const [attempted, setAttempted] = useState(false);
	const [photoError, setPhotoError] = useState<string | null>(null);
	const nameRef = useRef<HTMLInputElement>(null);

	const create = useCreateProduct(companyId);
	const update = useUpdateProduct(companyId);
	const upload = useUploadProductPhoto(companyId);

	const isPending = create.isPending || update.isPending;
	const errors = attempted
		? validateProduct({ name, sku, price, description })
		: {};
	const saveError = saveErrorMessage(create.error ?? update.error);
	const uploadError =
		upload.error instanceof ApiError
			? upload.error.message
			: upload.isError
				? PHOTO_FALLBACK_ERROR
				: undefined;
	const visiblePhotoError = photoError ?? uploadError;

	function goBackToList() {
		router.push("/dashboard/products");
	}

	function handlePhotoChange(file: File) {
		const nextError = validateProductPhoto(file);
		setPhotoError(nextError);
		if (nextError) {
			return;
		}
		// The file goes straight to the storage; what the product stores is its URL.
		upload.mutate(file, {
			onSuccess: (url) => setPhotoUrl(url),
		});
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setAttempted(true);

		const nextErrors = validateProduct({ name, sku, price, description });
		if (Object.keys(nextErrors).length > 0) {
			nameRef.current?.focus();
			return;
		}

		const body = {
			name: name.trim(),
			sku: normalizeSku(sku),
			price: normalizePrice(price),
			description: toNullableDescription(description),
			photoUrl,
		};

		if (product) {
			update.mutate(
				{ productId: product.id, ...body },
				{
					onSuccess: () => {
						AlertToast({
							title: "Actualización exitosa",
							description: `${product?.name ?? "El nuevo producto"} actualizado correctamente.`,
							type: "success",
							delay: 3000,
						});
						goBackToList();
					},
				},
			);
			return;
		}

		create.mutate(body, {
			onSuccess: () => {
				AlertToast({
					title: "Registro exitoso",
					description: `${name ?? "El nuevo producto"} creado correctamente.`,
					type: "success",
					delay: 3000,
				});
				goBackToList();
			},
		});
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			data-slot="product-form"
			aria-label={isEdit ? "Editar producto" : "Crear producto"}
			className="grid w-full min-w-0 max-w-3xl grid-cols-1 gap-4 rounded-xl border bg-surface p-4 sm:grid-cols-2 sm:p-6"
		>
			<TextField
				ref={nameRef}
				label="Nombre del producto"
				name="name"
				placeholder="Café molido 500g"
				autoComplete="off"
				className="sm:col-span-2"
				value={name}
				onChange={(event) => setName(event.target.value)}
				error={errors.name}
				disabled={isPending}
			/>
			<TextField
				label="Código SKU"
				name="sku"
				placeholder="CAF-500"
				autoComplete="off"
				value={sku}
				onChange={(event) => setSku(event.target.value)}
				error={errors.sku}
				hint="Se guarda en mayúsculas y no puede repetirse en la empresa."
				disabled={isPending}
			/>
			<TextField
				label="Precio unitario"
				name="price"
				inputMode="decimal"
				placeholder="1500.00"
				autoComplete="off"
				value={price}
				onChange={(event) => setPrice(event.target.value)}
				error={errors.price}
				hint="Hasta dos decimales, por ejemplo 1500.00."
				disabled={isPending}
			/>

			<TextareaField
				label="Descripción del producto"
				name="description"
				placeholder="Molido medio"
				className="sm:col-span-full"
				value={description}
				onChange={(event) => setDescription(event.target.value)}
				error={errors.description}
				disabled={isPending}
			/>

			<div className="sm:col-span-full">
				<ProductPhotoField
					photoUrl={photoUrl}
					onFileChange={handlePhotoChange}
					onClear={() => {
						setPhotoUrl(null);
						setPhotoError(null);
					}}
					error={visiblePhotoError ?? undefined}
					hint={upload.isPending ? "Subiendo la foto..." : undefined}
					disabled={isPending || upload.isPending}
				/>
			</div>

			{saveError ? (
				<div className="sm:col-span-full">
					<Alert variant="danger" title="No pudimos guardar el producto">
						{saveError}
					</Alert>
				</div>
			) : null}

			<div className="col-span-full flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
				<Link
					href="/dashboard/products"
					className={cn(
						buttonVariants({ variant: "outline" }),
						"h-10 w-full sm:w-30",
					)}
				>
					Cancelar
				</Link>
				<Button
					className="h-10 w-full sm:w-40"
					type="submit"
					disabled={isPending || upload.isPending}
				>
					{isPending ? (
						<>
							<SpinnerMotion size={20} className="mr-2" />
							{isEdit ? "Guardando..." : "Creando..."}
						</>
					) : isEdit ? (
						"Guardar cambios"
					) : (
						"Crear producto"
					)}
				</Button>
			</div>
		</form>
	);
}
