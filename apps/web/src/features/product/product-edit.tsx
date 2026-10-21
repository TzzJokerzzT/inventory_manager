"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { useActiveCompany } from "../company/store/company-selectors";
import { useProduct } from "./api/use-product";
import { ProductForm } from "./product-form";

const LOAD_ERROR_FALLBACK = "No pudimos cargar el producto.";

/**
 * Edit page shell (`/dashboard/products/{id}/edit`).
 *
 * The product is read from its own endpoint instead of the list cache: a direct
 * navigation, a reload or a bookmark arrives with a cold cache, and the form
 * still has to prefill. A `404 product_not_found` (another company's product, or
 * a soft-deleted one) arrives as an `ApiError` with its own message.
 */
export function EditProduct({ productId }: { productId: string }) {
	const company = useActiveCompany();
	const companyId = company?.id;
	const product = useProduct(companyId, productId);

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
						Editar producto
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
				aria-label="Formulario de edición"
				className="flex w-full justify-center"
			>
				{companyId === undefined ? (
					<p className="text-sm text-text-muted">
						Seleccioná una empresa para editar el producto.
					</p>
				) : product.isPending ? (
					<div className="flex justify-center p-8">
						<SpinnerMotion />
					</div>
				) : product.isError ? (
					<Alert variant="danger" title="No pudimos cargar el producto">
						{product.error instanceof ApiError
							? product.error.message
							: LOAD_ERROR_FALLBACK}
					</Alert>
				) : (
					<ProductForm companyId={companyId} product={product.data} />
				)}
			</section>
		</LazyMotionTag>
	);
}
