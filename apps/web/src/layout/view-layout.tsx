import type { ReactNode } from "react";

export function ViewLayout({
	ariaLabelledby,
	children,
}: {
	ariaLabelledby: string;
	children: ReactNode;
}) {
	return (
		<section
			aria-labelledby={ariaLabelledby}
			className="h-[calc(100vh-15rem)] flex items-center justify-center gap-3"
		>
			{children}
		</section>
	);
}
