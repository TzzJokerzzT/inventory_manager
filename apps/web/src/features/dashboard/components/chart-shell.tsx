import type { ReactNode } from "react";
import { Alert } from "@/components/design-system";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { SectionTitle } from "@/src/shared/components/SectionTitle";

const LOAD_ERROR_FALLBACK = "Probá de nuevo en unos segundos.";

/**
 * The frame every dashboard chart shares: an accessible section, a caption that
 * says where the numbers come from, and the chart itself.
 *
 * The caption is not decoration: each chart states that **it** reads the active
 * company, so a chart never depends on a notice somewhere else in the page to
 * explain its numbers (MI-14 S5).
 */
export function ChartShell({
	ariaLabel,
	title,
	caption,
	children,
}: {
	ariaLabel: string;
	title: string;
	caption: string;
	children: ReactNode;
}) {
	return (
		<SectionTitle ariaLabel={ariaLabel} title={title}>
			<p className="text-sm text-text-secondary">{caption}</p>
			{children}
		</SectionTitle>
	);
}

/** The same spinner the other data views use while a query is pending. */
export function ChartLoading() {
	return (
		<div className="flex justify-center p-8">
			<SpinnerMotion />
		</div>
	);
}

/**
 * The read failed: the API's own message when there is one, a plain fallback
 * otherwise, so a network failure never renders an empty chart.
 */
export function ChartError({
	title,
	error,
}: {
	title: string;
	error: unknown;
}) {
	return (
		<Alert variant="danger" title={title}>
			{error instanceof ApiError ? error.message : LOAD_ERROR_FALLBACK}
		</Alert>
	);
}

/** The read worked but there is nothing to draw yet. */
export function ChartEmpty({ children }: { children: ReactNode }) {
	return <p className="text-sm text-text-muted">{children}</p>;
}
