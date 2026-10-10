export function ViewHeader({
	title,
	subTitle,
}: {
	title: string;
	subTitle: string;
}) {
	return (
		<header className="flex items-center justify-between">
			<div>
				<h1 className="text-2xl font-bold text-text-primary">{title}</h1>
				<p className="mt-1 text-sm text-text-secondary">{subTitle}</p>
			</div>
		</header>
	);
}
