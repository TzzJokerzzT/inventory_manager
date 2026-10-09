"use client";

import { FullNameForm } from "./full-name-form";

/**
 * `/dashboard/user` profile section.
 *
 * It owns the presentation and reuses the same `FullNameForm` as the
 * `/sin-empresas` gate, so a name can be set or corrected from either place
 * with identical validation and feedback.
 */
export function User() {
	return (
		<section
			aria-labelledby="profile-heading"
			className="flex w-full max-w-md flex-col gap-6 rounded-md border border-border bg-surface p-8"
		>
			<header className="flex flex-col gap-2">
				<h1
					id="profile-heading"
					className="text-2xl font-bold text-text-primary"
				>
					Tu perfil
				</h1>
				<p className="text-base text-text-secondary">
					Así te vemos en el sistema. Podés actualizar tu nombre completo cuando
					quieras.
				</p>
			</header>

			<FullNameForm />
		</section>
	);
}
