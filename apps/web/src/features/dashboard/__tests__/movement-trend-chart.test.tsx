import { render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { MovementTrendPoint } from "@/lib/api/schemas";
import { useMovementTrend } from "../api/use-movement-trend";
import { MovementTrendChart } from "../components/movement-trend-chart";

jest.mock("recharts", () => jest.requireActual("../testing/recharts-mock"));
jest.mock("../api/use-movement-trend", () => ({
	...jest.requireActual("../api/use-movement-trend"),
	useMovementTrend: jest.fn(),
}));

const useMovementTrendMock = useMovementTrend as jest.MockedFunction<
	typeof useMovementTrend
>;

function point(
	overrides: Partial<MovementTrendPoint> = {},
): MovementTrendPoint {
	return { date: "2026-10-21", entries: 0, exits: 0, ...overrides };
}

function mockTrend(
	series: MovementTrendPoint[] | undefined,
	state: Record<string, unknown> = {},
	days = 30,
) {
	useMovementTrendMock.mockReturnValue({
		data: series === undefined ? undefined : { days, series },
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useMovementTrend>);
}

function chartData(): unknown[] {
	return JSON.parse(
		screen.getByTestId("chart-root").getAttribute("data-chart-data") ?? "[]",
	);
}

describe("MovementTrendChart", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("draws the server's series as it arrived, oldest first", () => {
		mockTrend([
			point({ date: "2026-10-20", entries: 0, exits: 0 }),
			point({ date: "2026-10-21", entries: 3, exits: 1 }),
		]);

		render(<MovementTrendChart companyId="c1" />);

		expect(chartData()).toEqual([
			{ date: "2026-10-20", entries: 0, exits: 0 },
			{ date: "2026-10-21", entries: 3, exits: 1 },
		]);
	});

	it("stacks entries and exits as two series", () => {
		mockTrend([point({ entries: 3, exits: 1 })]);

		render(<MovementTrendChart companyId="c1" />);

		const bars = screen.getAllByTestId("chart-bar");

		expect(bars.map((bar) => bar.getAttribute("data-chart-key"))).toEqual([
			"entries",
			"exits",
		]);
		expect(bars.map((bar) => bar.getAttribute("data-chart-name"))).toEqual([
			"Entradas",
			"Salidas",
		]);
		expect(bars.map((bar) => bar.getAttribute("data-chart-stack"))).toEqual([
			"movimientos",
			"movimientos",
		]);
	});

	it("explains that the chart covers the last N days", () => {
		mockTrend([point({ entries: 1 })], {}, 7);

		render(<MovementTrendChart companyId="c1" days={7} />);

		expect(useMovementTrendMock).toHaveBeenCalledWith("c1", 7);
		expect(screen.getByText(/Últimos 7 días/)).toBeTruthy();
	});

	it("summarises the window as text so the information is not chart-only", () => {
		mockTrend([
			point({ date: "2026-10-20", entries: 2, exits: 0 }),
			point({ date: "2026-10-21", entries: 3, exits: 4 }),
		]);

		render(<MovementTrendChart companyId="c1" />);

		expect(
			screen.getByText(
				"En los últimos 30 días entraron 5 unidades y salieron 4.",
			),
		).toBeTruthy();
	});

	it("says the numbers are the real data of the active company", () => {
		mockTrend([point({ entries: 1 })]);

		render(<MovementTrendChart companyId="c1" />);

		expect(screen.getByText(/datos reales de la empresa activa/i)).toBeTruthy();
	});

	it("asks for a company before drawing anything", () => {
		mockTrend([point({ entries: 1 })]);

		render(<MovementTrendChart companyId={undefined} />);

		expect(
			screen.getByText("Seleccioná una empresa para ver sus movimientos."),
		).toBeTruthy();
		expect(screen.queryByTestId("chart-root")).toBeNull();
	});

	it("shows a spinner while the report loads", () => {
		mockTrend(undefined, { isPending: true });

		render(<MovementTrendChart companyId="c1" />);

		expect(screen.getByLabelText("Cargando")).toBeTruthy();
	});

	it("shows the API error when the report cannot be read", () => {
		mockTrend(undefined, {
			isError: true,
			error: new ApiError("No pudimos leer el reporte."),
		});

		render(<MovementTrendChart companyId="c1" />);

		expect(
			screen.getByText("No pudimos cargar la evolución de movimientos"),
		).toBeTruthy();
		expect(screen.getByText("No pudimos leer el reporte.")).toBeTruthy();
	});

	it("shows an empty state when the report has no days", () => {
		mockTrend([]);

		render(<MovementTrendChart companyId="c1" />);

		expect(
			screen.getByText(/No hay movimientos en los últimos 30 días/),
		).toBeTruthy();
		expect(screen.queryByTestId("chart-root")).toBeNull();
	});

	it("shows an empty state when every day of the window is zero", () => {
		mockTrend([
			point({ date: "2026-10-20", entries: 0, exits: 0 }),
			point({ date: "2026-10-21", entries: 0, exits: 0 }),
		]);

		render(<MovementTrendChart companyId="c1" />);

		expect(
			screen.getByText(/No hay movimientos en los últimos 30 días/),
		).toBeTruthy();
		expect(screen.queryByTestId("chart-root")).toBeNull();
	});
});
