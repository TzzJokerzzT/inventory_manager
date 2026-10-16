import type { Metadata } from "next";
import { UserView } from "@/src/view/Dashboard/user-view";

export const metadata: Metadata = {
	title: "Usuario — Inventory Manager",
	description:
		"Tu perfil: consultá y actualizá tu nombre completo dentro del sistema.",
};

/**
 * `/dashboard/user` — the profile route inside the shell.
 *
 * The content lives in `UserView` → `User`, the same form the `/sin-empresas`
 * gate uses, so the name can also be corrected after onboarding.
 */
export default function UserPage() {
	return <UserView />;
}
