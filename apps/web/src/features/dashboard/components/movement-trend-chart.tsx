"use client";

import type { ReactNode } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { designTokens } from "@/components/design-system";
import {
	MOVEMENT_TREND_DEFAULT_DAYS,
	useMovementTrend,
} from "../api/use-movement-trend";
import {
	ChartEmpty,
	ChartError,
	ChartLoading,
	ChartShell,
} from "./chart-shell";

/**
 * Evolution of entries and exits over the last N days (S3).
 *
 * The series comes aggregated from the server: one point per **UTC day**, oldest
 * first and zero-filled for the days without movements, so the chart draws what
 * it receives and never re-buckets or re-sorts. It is real data of the active
 * company, and the caption says which window it covers because "last 30 days"
 * changes the meaning of every bar.
 *
 * Entries and exits are stacked — the stack total is the daily activity — and the
 * window is also summarised as text so the numbers do not depend on the bars.
 */
export function MovementTrendChart({
	companyId,
	days = MOVEMENT_TREND_DEFAULT_DAYS,
}: {
	companyId: string | undefined;
	days?: number;
}) {
	const trend = useMovementTrend(companyId, days);
	const series = trend.data?.series ?? [];
	const bars = series.map((point) => ({
		date: point.date,
		entries: point.entries,
		exits: point.exits,
	}));
	const totalEntries = bars.reduce((total, point) => total + point.entries, 0);
	const totalExits = bars.reduce((total, point) => total + point.exits, 0);
	const hasMovement = totalEntries + totalExits > 0;

	let content: ReactNode;

	if (companyId === undefined) {
		content = (
			<ChartEmpty>Seleccioná una empresa para ver sus movimientos.</ChartEmpty>
		);
	} else if (trend.isPending) {
		content = <ChartLoading />;
	} else if (trend.isError) {
		content = (
			<ChartError
				title="No pudimos cargar la evolución de movimientos"
				error={trend.error}
			/>
		);
	} else if (bars.length === 0 || !hasMovement) {
		content = (
			<ChartEmpty>No hay movimientos en los últimos {days} días.</ChartEmpty>
		);
	} else {
		content = (
			<figure
				aria-label={`Evolución de movimientos de los últimos ${days} días: entraron ${totalEntries} unidades y salieron ${totalExits}.`}
				className="flex min-w-0 flex-col gap-4"
			>
				<div className="h-72 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={bars}>
							<CartesianGrid vertical={false} />
							<XAxis dataKey="date" />
							<YAxis />
							<Tooltip />
							<Legend />
							<Bar
								dataKey="entries"
								name="Entradas"
								stackId="movimientos"
								fill={designTokens.success}
							/>
							<Bar
								dataKey="exits"
								name="Salidas"
								stackId="movimientos"
								fill={designTokens.danger}
							/>
						</BarChart>
					</ResponsiveContainer>
				</div>

				<p className="text-sm text-text-secondary">
					{`En los últimos ${days} días entraron ${totalEntries} unidades y salieron ${totalExits}.`}
				</p>
			</figure>
		);
	}

	return (
		<ChartShell
			ariaLabel="Evolución de entradas y salidas"
			title="Entradas y salidas"
			caption={`Datos reales de la empresa activa. Últimos ${days} días, un punto por día (UTC); los días sin movimientos se muestran en cero.`}
		>
			{content}
		</ChartShell>
	);
}
