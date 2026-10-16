import type { ReactNode } from "react";

export type SectionTitleProps = {
	ariaLabel: string;
	className?: string;
	title: string;
	children: ReactNode;
};

export function SectionTitle({
	ariaLabel,
	className = "flex flex-col gap-3",
	title,
	children,
}: SectionTitleProps) {
	return (
		<section aria-label={ariaLabel} className={className}>
			<h2 className="text-lg font-bold text-text-primary">{title}</h2>
			{children}
		</section>
	);
}
