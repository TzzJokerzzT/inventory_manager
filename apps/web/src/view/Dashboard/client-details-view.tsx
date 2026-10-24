import { ClientDetails } from "@/src/features/client/client-details";

export function ClientDetailsView({ customerId }: { customerId: string }) {
	return <ClientDetails customerId={customerId} />;
}
