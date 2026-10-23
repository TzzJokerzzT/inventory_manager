import type { ReactNode } from "react";

/**
 * The slice of Recharts the dashboard charts use, replaced in tests.
 *
 * Recharts measures its container with `ResizeObserver` and draws into measured
 * pixel sizes, so in jsdom it renders nothing we can assert and every
 * `ResponsiveContainer` would need a fake size. Mocking the primitives keeps the
 * component test focused on what the chart is told to draw: each mock exposes
 * the `data` and the series keys as `data-*` attributes, and the test asserts
 * those instead of the SVG.
 *
 * Used through `jest.mock("recharts", () => jest.requireActual("./recharts-mock"))`.
 */
export function ResponsiveContainer({ children }: { children?: ReactNode }) {
	return <div data-testid="chart-frame">{children}</div>;
}

function Root({
	data,
	children,
}: {
	data?: readonly unknown[];
	children?: ReactNode;
}) {
	return (
		<div data-testid="chart-root" data-chart-data={JSON.stringify(data ?? [])}>
			{children}
		</div>
	);
}

export function BarChart(props: {
	data?: readonly unknown[];
	children?: ReactNode;
}) {
	return <Root {...props} />;
}

export function PieChart(props: {
	data?: readonly unknown[];
	children?: ReactNode;
}) {
	return <Root {...props} />;
}

export function Bar({
	dataKey,
	name,
	stackId,
	children,
}: {
	dataKey?: string;
	name?: string;
	stackId?: string;
	children?: ReactNode;
}) {
	return (
		<div
			data-testid="chart-bar"
			data-chart-key={dataKey}
			data-chart-name={name}
			data-chart-stack={stackId}
		>
			{children}
		</div>
	);
}

export function Pie({
	data,
	dataKey,
	nameKey,
	children,
}: {
	data?: readonly unknown[];
	dataKey?: string;
	nameKey?: string;
	children?: ReactNode;
}) {
	return (
		<div
			data-testid="chart-pie"
			data-chart-data={JSON.stringify(data ?? [])}
			data-chart-key={dataKey}
			data-chart-name-key={nameKey}
		>
			{children}
		</div>
	);
}

export function Cell({ fill }: { fill?: string }) {
	return <div data-testid="chart-cell" data-chart-fill={fill} />;
}

export function XAxis({ dataKey }: { dataKey?: string }) {
	return <div data-testid="chart-x-axis" data-chart-key={dataKey} />;
}

export function YAxis({ dataKey }: { dataKey?: string }) {
	return <div data-testid="chart-y-axis" data-chart-key={dataKey} />;
}

export function Tooltip() {
	return null;
}

export function Legend() {
	return null;
}

export function CartesianGrid() {
	return null;
}
