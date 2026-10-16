"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { type Column, DataTable } from "@/components/design-system";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { type CustomerRow, customers } from "@/src/utils/mockData";

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
			className="flex min-w-0 flex-col gap-4 sm:gap-6"
		>
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<h1 className="text-xl font-bold text-text-primary sm:text-2xl">
						Clientes
					</h1>
					<p className="mt-1 text-sm text-text-secondary">
						Registrá entradas y salidas; el stock se actualiza automáticamente.
					</p>
				</div>
				<Link href="/dashboard/products/create" className="w-full sm:w-auto">
					<Button className="h-12 w-full sm:w-auto">
						<Plus className="mr-2 size-5" />
						Nuevo Cliente
					</Button>
				</Link>
			</header>

			<section
				aria-label="Stock"
				className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_25.5rem] xl:items-start"
			>
				<div className="min-w-0">
					<DataTable
						columns={clientColumns}
						rows={customers}
						getRowKey={(row) => row.name}
					/>
				</div>

				<Card className="min-w-0">
					<CardHeader className="flex flex-col items-start gap-4">
						<div className="flex w-full min-w-0 items-center gap-3">
							<Avatar size="lg" className="shrink-0">
								<AvatarImage
									src="https://github.com/shadcn.png"
									alt="@shadcn"
									className="grayscale"
								/>
								<AvatarFallback>CN</AvatarFallback>
							</Avatar>
							<div className="min-w-0">
								<h2 className="truncate font-medium">Distribuidora Perez</h2>
								<p className="truncate text-sm text-text-secondary">
									distribuidora@email.com
								</p>
							</div>
						</div>
						<CardDescription className="flex w-full flex-col gap-3 sm:flex-row sm:gap-4">
							<Button variant="outline" className="h-10 w-full sm:w-auto">
								Editar
							</Button>
							<Button className="h-10 w-full sm:w-auto">Registrar Venta</Button>
						</CardDescription>
					</CardHeader>
					<div className="w-full border border-sidebar-border"></div>
				</Card>
			</section>
		</LazyMotionTag>
	);
}
