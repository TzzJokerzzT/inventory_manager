import { toast } from "@/components/ui/toast";

type AlertToastProps = {
	title: string;
	description: string;
	type?: "success" | "warning" | "error";
};

export function AlertToast({
	title,
	description,
	type = "success",
}: AlertToastProps) {
	return toast.add({
		title,
		description,
		type,
	});
}
