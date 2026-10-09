import type { Metadata } from "next";
import { ClientView } from "@/src/view/Dashboard/client-view";

export const metadata: Metadata = {
	title: "Clientes — Inventory Manager",
	description:
		"Panel de control de clientes donde podras gestionar los clientes que realizan a tu empresa.",
};

export default function ClientsPage() {
	return <ClientView />;
}
