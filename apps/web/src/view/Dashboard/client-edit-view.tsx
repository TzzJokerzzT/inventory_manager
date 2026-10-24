import { ClientWrite } from "@/src/features/client/client-write";

export function ClientEditView({ customerId }: { customerId: string }) {
	return <ClientWrite customerId={customerId} />;
}
