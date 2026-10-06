import type { Metadata } from "next";
import LoginView from "@/src/view/Auth/LoginView";

export const metadata: Metadata = {
	title: "Iniciar sesión — Inventory Manager",
	description:
		"Ingresá con tu cuenta para gestionar productos, movimientos y alertas de stock.",
};

export default function LoginPage() {
	return <LoginView />;
}
