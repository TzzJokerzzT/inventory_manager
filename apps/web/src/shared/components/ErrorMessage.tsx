import { Button } from "@/components/ui/button";

export function ErrorMessage({
	message,
	action,
	btnMessage,
}: {
	message: string;
	action: () => void;
	btnMessage: string;
}) {
	return (
		<div
			role="alert"
			className="flex w-full max-w-2xl flex-col items-center gap-3 rounded-md border border-border bg-surface p-8"
		>
			<p className="text-base text-danger-text">{message}</p>
			<Button
				type="button"
				onClick={() => action()}
				className="h-10 rounded-md"
			>
				{btnMessage}
			</Button>
		</div>
	);
}
