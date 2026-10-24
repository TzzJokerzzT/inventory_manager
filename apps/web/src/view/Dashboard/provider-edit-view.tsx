import { ProviderWrite } from "@/src/features/provider/provider-write";

export function ProviderEditView({ providerId }: { providerId: string }) {
	return <ProviderWrite providerId={providerId} />;
}
