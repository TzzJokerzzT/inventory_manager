import { toast } from "@/components/ui/toast";

type AlertToastProps = {
	title: string;
	description: string;
	type?: "success" | "warning" | "error";
	autoclose?: boolean;
	delay?: number;
};

export function AlertToast({
	title,
	description,
	type = "success",
	autoclose = true,
	delay = 3000,
}: AlertToastProps) {
	return toast.add({
		title,
		description,
		type,
		// Base UI dismisses a toast after `timeout` milliseconds and reads `0` as
		// "never dismiss automatically", so the two props collapse into that one
		// field. Leaving it out falls back to the provider default (5000) and
		// forces the caller to close the toast by hand, which is what this
		// helper exists to avoid.
		timeout: autoclose ? delay : 0,
	});
}
