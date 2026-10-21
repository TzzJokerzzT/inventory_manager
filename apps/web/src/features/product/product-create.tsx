"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { useActiveCompany } from "../company/store/company-selectors";
import { useMe } from "../user/api/use-me";
import { canManageProducts, roleForCompany } from "./lib/product-permissions";
import { ProductForm } from "./product-form";

/**
 * Create page shell (`/dashboard/products/create`).
 *
 * The role check here is UX only, mirroring the list: while `/me` is still
 * loading it renders the form, and the API answers `403 insufficient_role` if a
 * MEMBER got this far. The server is the real guard; hiding the form once the
 * role is known only spares them a form that cannot succeed.
 */
export function CreateProduct() {
	const company = useActiveCompany();
	const { data: me } = useMe();
	const companyId = company?.id;
	const allowed =
		me === undefined ? true : canManageProducts(roleForCompany(me, companyId));

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
						Nuevo producto
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
				className="flex w-full justify-center"
			>
				{companyId === undefined ? (
					<p className="text-sm text-text-muted">
						Seleccioná una empresa para crear un producto.
					</p>
				) : allowed ? (
					<ProductForm companyId={companyId} />
				) : (
					<Alert variant="danger" title="No podés crear productos">
						Tu rol en esta empresa no permite crear productos.
					</Alert>
				)}
			</section>
		</LazyMotionTag>
	);
}
