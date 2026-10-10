import { Skeleton } from "@/components/ui/skeleton";

function DetailItemSkeleton() {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<Skeleton className="h-5 w-28" /> {/* dt: text-sm */}
			<Skeleton className="h-6 w-full max-w-56" /> {/* dd: text-base */}
		</div>
	);
}

export function UserSkeleton() {
	return (
		<section
			aria-busy="true"
			aria-label="Cargando perfil"
			className="flex flex-col gap-6"
		>
			{/* Encabezado: es texto estático, se muestra real para evitar saltos */}
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-text-primary">Clientes</h1>
					<p className="mt-1 text-sm text-text-secondary">
						Ver la información relacionada a su usuario.
					</p>
				</div>
			</header>

			<div className="w-full border border-sidebar-border" />

			<div className="flex h-[calc(100vh-15rem)] items-center justify-center gap-3">
				<div className="flex w-full max-w-2xl flex-col gap-8 rounded-md border border-border bg-surface p-8">
					{/* Avatar + nombre + correo */}
					<div className="flex items-center gap-4">
						<Skeleton className="size-16 shrink-0 rounded-full" />
						<div className="flex min-w-0 flex-1 flex-col gap-1">
							<Skeleton className="h-8 w-2/3" /> {/* text-2xl */}
							<Skeleton className="h-6 w-1/2" /> {/* text-base */}
						</div>
					</div>

					{/* Grilla de datos */}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<DetailItemSkeleton />
						<DetailItemSkeleton />
						<DetailItemSkeleton />
						<DetailItemSkeleton />
					</div>

					{/* Empresas */}
					<div className="flex flex-col gap-3">
						<Skeleton className="h-7 w-24" /> {/* h2: text-lg */}
						<div className="flex items-center gap-3 rounded-md border border-border px-4 py-3">
							<Skeleton className="size-5 shrink-0" />
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<Skeleton className="h-6 w-1/2" />
								<Skeleton className="h-4 w-1/3" /> {/* text-xs */}
							</div>
							<Skeleton className="h-6 w-24 shrink-0 rounded-full" />
						</div>
					</div>

					{/* Actualizar nombre */}
					<div className="flex flex-col gap-3">
						<Skeleton className="h-7 w-44" /> {/* h2: text-lg */}
						<div className="flex flex-col gap-2">
							<Skeleton className="h-5 w-32" /> {/* label */}
							<Skeleton className="h-12 w-full rounded-md" /> {/* input h-12 */}
						</div>
						<Skeleton className="h-10 w-32 rounded-md" /> {/* botón */}
					</div>
				</div>
			</div>
		</section>
	);
}
