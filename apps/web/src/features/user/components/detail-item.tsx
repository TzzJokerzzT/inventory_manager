export function DetailItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<dt className="text-sm text-text-secondary">{label}</dt>
			<dd className="truncate text-base text-text-primary">{value}</dd>
		</div>
	);
}
