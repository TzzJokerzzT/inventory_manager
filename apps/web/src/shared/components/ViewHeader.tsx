import type { ReactNode } from "react";

export function ViewHeader({
	title,
	className = "flex items-center justify-between",
	subTitle,
	children,
}: {
	title: string;
	className?: string;
	subTitle: string;
	children?: ReactNode;
}) {
	return (
		<header className={className}>
			<div>
				<h1 className="text-2xl font-bold text-text-primary">{title}</h1>
				<p className="mt-1 text-sm text-text-secondary">{subTitle}</p>
			</div>
			{children}
		</header>
	);
}
