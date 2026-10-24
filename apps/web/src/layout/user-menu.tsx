"use client";

import { ChevronDown, LogOut, Plus, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/src/features/auth/logout/use-logout";
import { CreateCompanyModal } from "@/src/features/company/components/create-company-modal";

/**
 * The account area of the dashboard top bar.
 *
 * It replaces the bare logout button because there is a second account-level
 * action now: creating another company. The trigger and the panel mirror the
 * company switcher (menu semantics, Escape closes, absolute panel) instead of
 * inventing a second interaction language for the same header.
 *
 * "Crear empresa" lives here — and not in the switcher — because the switcher
 * hides itself with fewer than two companies, which is exactly the case of the
 * owner who wants a second one.
 */
export function UserMenu() {
	const logout = useLogout();
	const [open, setOpen] = useState(false);
	const [createCompanyOpen, setCreateCompanyOpen] = useState(false);

	useEffect(() => {
		if (!open) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setOpen(false);
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open]);

	const itemClasses =
		"flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted";

	return (
		<div className="relative">
			<Button
				type="button"
				variant="outline"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label="Cuenta"
				onClick={() => setOpen((value) => !value)}
				className="rounded-md"
			>
				<UserRound aria-hidden="true" className="size-4" />
				<span className="hidden sm:inline">Cuenta</span>
				<ChevronDown
					aria-hidden="true"
					className={
						open
							? "size-4 rotate-180 transition-transform"
							: "size-4 transition-transform"
					}
				/>
			</Button>

			{open ? (
				<div
					role="menu"
					aria-label="Cuenta"
					className="absolute top-full right-0 z-10 mt-2 w-56 overflow-hidden rounded-md border border-border bg-surface shadow-md"
				>
					<button
						type="button"
						role="menuitem"
						className={itemClasses}
						onClick={() => {
							setOpen(false);
							setCreateCompanyOpen(true);
						}}
					>
						<Plus aria-hidden="true" className="size-4" />
						Crear empresa
					</button>
					<button
						type="button"
						role="menuitem"
						className={itemClasses}
						onClick={() => {
							setOpen(false);
							logout();
						}}
					>
						<LogOut aria-hidden="true" className="size-4" />
						Cerrar sesión
					</button>
				</div>
			) : null}

			<CreateCompanyModal
				open={createCompanyOpen}
				onOpenChange={setCreateCompanyOpen}
			/>
		</div>
	);
}
