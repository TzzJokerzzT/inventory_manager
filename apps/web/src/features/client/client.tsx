"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { type Column, DataTable } from "@/components/design-system";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { type CustomerRow, customers } from "../dashboard/mock";

const clientColumns: Column<CustomerRow>[] = [
	{ key: "name", header: "Client" },
	{ key: "phone", header: "Telefono" },
	{ key: "purchases", header: "Compras" },
	{ key: "totalSpent", header: "Total" },
];

export function Client() {
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
					<h1 className="text-2xl font-bold text-text-primary">Clientes</h1>
					<p className="mt-1 text-sm text-text-secondary">
						Registrá entradas y salidas; el stock se actualiza automáticamente.
					</p>
				</div>
				<Link href="/dashboard/products/create">
					<Button className="h-12">
						<Plus className="mr-2 size-5" />
						Nuevo Cliente
					</Button>
				</Link>
			</header>

			<section
				aria-label="Stock"
				className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_25.5rem]"
			>
				<DataTable
					columns={clientColumns}
					rows={customers}
					getRowKey={(row) => row.name}
				/>

				<Card>
					<CardHeader className="flex flex-col items-start gap-4">
						<div className="flex gap-2">
							<Avatar size="lg">
								<AvatarImage
									src="https://github.com/shadcn.png"
									alt="@shadcn"
									className="grayscale"
								/>
								<AvatarFallback>CN</AvatarFallback>
							</Avatar>
							<div>
								<h1>Distribuidora Perez</h1>
								<p>distribuidora@email.com</p>
							</div>
						</div>
						<CardDescription className="flex gap-4">
							<Button variant="outline" className="h-10">
								Editar
							</Button>
							<Button className="h-10">Registrar Venta</Button>
						</CardDescription>
					</CardHeader>
					<div className="w-full border border-sidebar-border"></div>
				</Card>
			</section>
		</LazyMotionTag>
	);
}
