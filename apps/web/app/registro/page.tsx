import type { Metadata } from "next";
import RegisterView from "@/src/view/Auth/RegisterForm";

export const metadata: Metadata = {
	title: "Registra tu cuenta — Inventory Manager",
	description:
		"Registra tu cuenta de forma gratuita para gestionar productos, movimientos y alertas de stock.",
};

export default function RegisterPage() {
	return <RegisterView />;
}
