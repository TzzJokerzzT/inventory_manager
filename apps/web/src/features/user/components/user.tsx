"use client";

import { Building2 } from "lucide-react";
import { Divider } from "@/components/ui/divider";
import { MembersSection } from "@/src/features/member/components/members-section";
import { PendingInvitationsSection } from "@/src/features/member/components/pending-invitations-section";
import { NotificationsSection } from "@/src/features/notification/components/notifications-section";
import { LazyMotionTag } from "@/src/shared/components/Animation";
import { ErrorMessage } from "@/src/shared/components/ErrorMessage";
import { ViewHeader } from "@/src/shared/components/ViewHeader";
import { ROLE_LABELS } from "@/src/utils/constants";
import { getInitials } from "@/src/utils/getInitials";
import { formatDate } from "@/src/utils/mockData";
import { MembersListSkeleton } from "../../member/components/member-skeleton";
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
	const { data: user, isError, refetch } = useMe();

	const isPending = false;

	if (isPending) {
		return (
			<LazyMotionTag
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				tag="section"
				className="flex flex-col gap-4 sm:gap-6"
			>
				<ViewHeader
					title="Usuario"
					subTitle="Ver la información relacionada a su usuario, gestionar los miembros de su empresa y recibir notificaciones."
				/>

				<Divider />

				<section
					aria-labelledby="profile-heading"
					className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] *:min-w-0"
				>
					<UserSkeleton />

					<div className="flex w-full flex-col rounded-md border border-border bg-surface p-4 sm:p-6 lg:p-8">
						<MembersListSkeleton />
					</div>

					{/*
					 * Its own card, because the section hides itself when there is no news
					 * and an empty card would be noise. The block only exists for a caller
					 * who has something to read.
					 */}
					<NotificationsSection />
				</section>
			</LazyMotionTag>
		);
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
			className="flex flex-col gap-4 sm:gap-6"
		>
			<ViewHeader
				title="Usuario"
				subTitle="Ver la información relacionada a su usuario, gestionar los miembros de su empresa y recibir notificaciones."
			/>

			<Divider />

			<section
				aria-labelledby="profile-heading"
				className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] *:min-w-0"
			>
				<div className="flex w-full flex-col gap-6 rounded-md border border-border bg-surface p-4 sm:gap-8 sm:p-6 lg:p-8">
					<div className="flex items-center gap-3 sm:gap-4">
						<div
							aria-hidden="true"
							className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary sm:size-16 sm:text-xl"
						>
							{getInitials(user.fullName || "")}
						</div>
						<div className="flex min-w-0 flex-col gap-1">
							<h1
								id="profile-heading"
								className="truncate text-xl font-bold text-text-primary sm:text-2xl"
							>
								{user.fullName}
							</h1>
							<p className="truncate text-sm text-text-secondary sm:text-base">
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
							className="text-base font-semibold text-text-primary sm:text-lg"
						>
							Empresas
						</h2>
						{user.memberships.length > 0 ? (
							<ul className="flex flex-col gap-2">
								{user.memberships.map((membership) => (
									<li
										key={membership.companyId}
										className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border px-3 py-3 sm:flex-nowrap sm:px-4"
									>
										<Building2
											aria-hidden="true"
											className="size-5 shrink-0 text-text-muted"
										/>
										<div className="flex min-w-0 flex-1 basis-40 flex-col">
											<span className="truncate text-sm text-text-primary sm:text-base">
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

					{/*
					 * This mount exists because `/sin-empresas` --the other one-- is only
					 * reachable with zero companies: someone who already belongs to a
					 * company would never see the invitation to the next one. The section
					 * renders itself only when there is something to accept.
					 */}
					<PendingInvitationsSection />

					<section
						aria-labelledby="edit-heading"
						className="flex flex-col gap-3"
					>
						<h2
							id="edit-heading"
							className="text-base font-semibold text-text-primary sm:text-lg"
						>
							Actualizar nombre
						</h2>
						<FullNameForm />
					</section>
				</div>

				<div className="flex w-full flex-col gap-6 rounded-md border border-border bg-surface p-4 sm:p-6 lg:p-8">
					<MembersSection />
				</div>

				{/*
				 * Its own card, because the section hides itself when there is no news
				 * and an empty card would be noise. The block only exists for a caller
				 * who has something to read.
				 */}
				<NotificationsSection />
			</section>
		</LazyMotionTag>
	);
}
