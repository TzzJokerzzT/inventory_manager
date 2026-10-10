"use client";

import { Building2 } from "lucide-react";
import { Divider } from "@/components/ui/divider";
import { ViewLayout } from "@/src/layout/view-layout";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { ErrorMessage } from "@/src/shared/components/ErrorMessage";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { ROLE_LABELS } from "@/src/utils/constants";
import { getInitials } from "@/src/utils/getInitials";
import { formatDate } from "../../dashboard/mock";
import { useMe } from "../api/use-me";
import { DetailItem } from "./detail-item";
import { FullNameForm } from "./full-name-form";
import { UserSkeleton } from "./user-skeleton";

/**
 * `/dashboard/user` profile section.
 *
 * Shows the user's details (read-only) and reuses `FullNameForm` so the name
 * can be corrected with the same validation as the `/sin-empresas` gate.
 */
export function User() {
	const { data: user, isPending, isError, refetch } = useMe();

	if (isPending) {
		return <UserSkeleton />;
	}

	if (isError || !user) {
		return (
			<LazyMotionTag
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				tag="section"
				className="h-[calc(100vh-15rem)] flex items-center justify-center gap-3"
			>
				<ErrorMessage
					message="No pudimos cargar tu perfil."
					action={refetch}
					btnMessage="Reintentar"
				/>
			</LazyMotionTag>
		);
	}

	return (
		<LazyMotionTag
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			tag="section"
			className="flex flex-col gap-6"
		>
			<ViewHeader
				title="Clientes"
				subTitle="Ver la información relacionada a su usuario."
			/>

			<Divider />

			<ViewLayout ariaLabelledby="profile-heading">
				<div className="flex w-full max-w-2xl flex-col gap-8 rounded-md border border-border bg-surface p-8">
					<div className="flex items-center gap-4">
						<div
							aria-hidden="true"
							className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary"
						>
							{getInitials(user.fullName || "")}
						</div>
						<div className="flex min-w-0 flex-col gap-1">
							<h1
								id="profile-heading"
								className="truncate text-2xl font-bold text-text-primary"
							>
								{user.fullName}
							</h1>
							<p className="truncate text-base text-text-secondary">
								{user.email}
							</p>
						</div>
					</div>

					<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<DetailItem label="Nombre completo" value={user.fullName || ""} />
						<DetailItem label="Correo electrónico" value={user.email} />
						<DetailItem
							label="Miembro desde"
							value={formatDate(user.createdAt)}
						/>
						<DetailItem label="ID de usuario" value={user.id} />
					</dl>

					<section
						aria-labelledby="companies-heading"
						className="flex flex-col gap-3"
					>
						<h2
							id="companies-heading"
							className="text-lg font-semibold text-text-primary"
						>
							Empresas
						</h2>
						{user.memberships.length > 0 ? (
							<ul className="flex flex-col gap-2">
								{user.memberships.map((membership) => (
									<li
										key={membership.companyId}
										className="flex items-center gap-3 rounded-md border border-border px-4 py-3"
									>
										<Building2
											aria-hidden="true"
											className="size-5 shrink-0 text-text-muted"
										/>
										<div className="flex min-w-0 flex-1 flex-col">
											<span className="truncate text-base text-text-primary">
												{membership.company.name}
											</span>
											<span className="text-xs text-text-muted">
												Creada el {formatDate(membership.company.createdAt)}
											</span>
										</div>
										<span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
											{ROLE_LABELS[membership.role] ?? membership.role}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className="text-sm text-text-muted">
								Todavía no perteneces a ninguna empresa.
							</p>
						)}
					</section>

					<section
						aria-labelledby="edit-heading"
						className="flex flex-col gap-3"
					>
						<h2
							id="edit-heading"
							className="text-lg font-semibold text-text-primary"
						>
							Actualizar nombre
						</h2>
						<FullNameForm />
					</section>
				</div>
			</ViewLayout>
		</LazyMotionTag>
	);
}
