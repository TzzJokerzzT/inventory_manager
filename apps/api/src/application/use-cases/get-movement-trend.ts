import type { StockMovementRepository } from "../../domain/repositories/stock-movement-repository.js";

/**
 * The contract's default window. It lives next to the use case that applies
 * it, so the HTTP validator and the report agree on one number.
 */
export const DEFAULT_MOVEMENT_TREND_DAYS = 30;

/** The contract's window bounds: `days` is an integer in `1..90`. */
export const MIN_MOVEMENT_TREND_DAYS = 1;
export const MAX_MOVEMENT_TREND_DAYS = 90;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** One UTC day of the trend: the quantities that moved, not the row count. */
export interface MovementTrendPoint {
	/** The UTC day, as `YYYY-MM-DD`. */
	date: string;
	/** Sum of the quantities of the `IN` movements of that day. */
	entries: number;
	/** Sum of the quantities of the `OUT` movements of that day. */
	exits: number;
}

export interface GetMovementTrendInput {
	/** Number of UTC days in the series, ending today. */
	days: number;
}

export interface GetMovementTrendContext {
	/** The company whose movements are aggregated. */
	companyId: string;
}

export interface GetMovementTrendReport {
	days: number;
	/** One point per UTC day, oldest first, zero-filled. */
	series: MovementTrendPoint[];
}

export interface GetMovementTrendDependencies {
	stockMovementRepository: StockMovementRepository;
	/**
	 * The clock, injected so the suite can pin the day the series ends on. It
	 * defaults to the real one, which is what production uses.
	 */
	now?: () => Date;
}

/**
 * UTC-day key of a date.
 *
 * The aggregate is per **UTC day on purpose** (L6): a day computed from the
 * server's local zone would move with the machine that runs the API and would
 * not match the days the browser draws.
 */
function utcDayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** The first millisecond of the UTC day `date` falls in. */
function startOfUtcDay(date: Date): number {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Use case for the dashboard's entries/exits trend (S3).
 *
 * The series is computed here, from the movements of the window, instead of
 * with raw SQL (L5): for the volume of a small business over 30 or 90 days the
 * read is bounded and acceptable, and the day bucketing stays in one testable
 * place. If the volume grew, the next step is a `GROUP BY` in the adapter, not
 * a change of contract.
 *
 * Every day of the window is a point, oldest first, ending on today's UTC day,
 * so the chart never has to fill a gap itself: a day without movements answers
 * zeros. `entries`/`exits` are the **sum of quantities** of the `IN`/`OUT`
 * movements of the day, never the number of movements, and they stay integers
 * because a movement's quantity is always an integer.
 *
 * Reading needs **no role**: an ACTIVE membership is proven by the company
 * context, and the company filter is the `companyId` of the range read (S6).
 */
export class GetMovementTrendUseCase {
	private readonly stockMovementRepository: StockMovementRepository;
	private readonly now: () => Date;

	constructor(dependencies: GetMovementTrendDependencies) {
		this.stockMovementRepository = dependencies.stockMovementRepository;
		this.now = dependencies.now ?? (() => new Date());
	}

	async execute(
		input: GetMovementTrendInput,
		context: GetMovementTrendContext,
	): Promise<GetMovementTrendReport> {
		const { days } = input;

		// Today is the last day of the window, so the range starts `days - 1`
		// UTC days before it: with `days = 1` the only point is today.
		const today = startOfUtcDay(this.now());
		const since = new Date(today - (days - 1) * MILLISECONDS_PER_DAY);

		const movements = await this.stockMovementRepository.findSince(
			context.companyId,
			since,
		);

		// The map is filled oldest first and keeps that insertion order, which is
		// exactly the order the contract asks the series in.
		const buckets = new Map<string, MovementTrendPoint>();
		for (let offset = 0; offset < days; offset += 1) {
			const date = utcDayKey(
				new Date(since.getTime() + offset * MILLISECONDS_PER_DAY),
			);
			buckets.set(date, { date, entries: 0, exits: 0 });
		}

		for (const movement of movements) {
			const bucket = buckets.get(utcDayKey(movement.createdAt));

			// The adapter already filters by the range; a row outside it (a clock
			// skew, a future movement) has no day to land on and is not invented
			// into one.
			if (bucket === undefined) {
				continue;
			}

			if (movement.type === "IN") {
				bucket.entries += movement.quantity;
			} else {
				bucket.exits += movement.quantity;
			}
		}

		return { days, series: Array.from(buckets.values()) };
	}
}
