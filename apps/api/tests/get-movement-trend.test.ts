import { GetMovementTrendUseCase } from "../src/application/use-cases/get-movement-trend.js";
import { StockMovement } from "../src/domain/entities/stock-movement.js";
import type { StockMovementRepository } from "../src/domain/repositories/stock-movement-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";
const PRODUCT = "product-1";

/**
 * The clock is fixed on purpose: the report is defined per **UTC day**, so the
 * day it ends on must not float with the machine that runs the suite.
 */
const NOW = new Date("2026-10-21T12:00:00.000Z");
const TODAY = "2026-10-21";

function movement(
	overrides: Partial<Parameters<typeof StockMovement.create>[0]> = {},
) {
	return StockMovement.create({
		id: `movement-${Math.random().toString(36).slice(2)}`,
		companyId: COMPANY,
		productId: PRODUCT,
		userId: "user-1",
		type: "IN",
		quantity: 5,
		createdAt: new Date("2026-10-20T09:00:00.000Z"),
		...overrides,
	});
}

/**
 * The use case over the real in-memory adapter, with the clock injected. The
 * adapter's `save` is adapter-specific and lets the fixture insert a movement
 * with its own `createdAt`, which is exactly what the days of the series are
 * built from.
 */
function build(options: { movements?: StockMovement[]; now?: Date } = {}) {
	const repository = new InMemoryStockMovementRepository(new Map());

	for (const row of options.movements ?? []) {
		repository.save(row);
	}

	const useCase = new GetMovementTrendUseCase({
		stockMovementRepository: repository,
		now: () => options.now ?? NOW,
	});

	return { repository, useCase };
}

/** A port double that only records what the use case asks the store for. */
function spyRepository() {
	const findSince = jest.fn(async () => []);
	const repository = {
		register: jest.fn(),
		findByCompany: jest.fn(),
		findSince,
	} as unknown as StockMovementRepository;

	return { findSince, repository };
}

function context() {
	return { companyId: COMPANY };
}

describe("GetMovementTrendUseCase", () => {
	it("answers exactly `days` points, oldest first, ending on today's UTC date", async () => {
		const { useCase } = build();

		const report = await useCase.execute({ days: 3 }, context());

		expect(report.days).toBe(3);
		expect(report.series).toEqual([
			{ date: "2026-10-19", entries: 0, exits: 0 },
			{ date: "2026-10-20", entries: 0, exits: 0 },
			{ date: "2026-10-21", entries: 0, exits: 0 },
		]);
	});

	it("zero-fills the days without movements", async () => {
		const { useCase } = build({
			movements: [movement({ type: "IN", quantity: 7, createdAt: NOW })],
		});

		const report = await useCase.execute({ days: 3 }, context());

		// The day in the middle has no movement and is still a point: the chart
		// needs a value for every day it draws.
		expect(report.series).toEqual([
			{ date: "2026-10-19", entries: 0, exits: 0 },
			{ date: "2026-10-20", entries: 0, exits: 0 },
			{ date: "2026-10-21", entries: 7, exits: 0 },
		]);
	});

	it("sums the quantities of the day instead of counting movements", async () => {
		const { useCase } = build({
			movements: [
				movement({
					type: "IN",
					quantity: 5,
					createdAt: new Date("2026-10-21T08:00:00.000Z"),
				}),
				movement({
					type: "IN",
					quantity: 3,
					createdAt: new Date("2026-10-21T18:00:00.000Z"),
				}),
			],
		});

		const report = await useCase.execute({ days: 1 }, context());

		// Two movements, one point: eight units entered, not "2".
		expect(report.series).toEqual([{ date: TODAY, entries: 8, exits: 0 }]);
	});

	it("separates the entries from the exits of the same day", async () => {
		const { useCase } = build({
			movements: [
				movement({
					type: "IN",
					quantity: 5,
					createdAt: new Date("2026-10-21T08:00:00.000Z"),
				}),
				movement({
					type: "OUT",
					quantity: 2,
					createdAt: new Date("2026-10-21T09:00:00.000Z"),
				}),
			],
		});

		const report = await useCase.execute({ days: 1 }, context());

		expect(report.series).toEqual([{ date: TODAY, entries: 5, exits: 2 }]);
	});

	it("ignores the movements before the range", async () => {
		const { useCase } = build({
			movements: [
				movement({
					type: "IN",
					quantity: 9,
					createdAt: new Date("2026-10-19T23:59:59.000Z"),
				}),
				movement({
					type: "IN",
					quantity: 4,
					createdAt: new Date("2026-10-20T00:00:00.000Z"),
				}),
			],
		});

		const report = await useCase.execute({ days: 2 }, context());

		// The range starts at the beginning of the oldest UTC day: 23:59:59 of
		// the day before is out, the very first millisecond of the range is in.
		expect(report.series).toEqual([
			{ date: "2026-10-20", entries: 4, exits: 0 },
			{ date: TODAY, entries: 0, exits: 0 },
		]);
	});

	it("keeps a movement at 23:59Z and one at 00:01Z on different UTC days", async () => {
		const { useCase } = build({
			movements: [
				movement({
					type: "IN",
					quantity: 4,
					createdAt: new Date("2026-10-20T23:59:00.000Z"),
				}),
				movement({
					type: "OUT",
					quantity: 2,
					createdAt: new Date("2026-10-21T00:01:00.000Z"),
				}),
			],
		});

		const report = await useCase.execute({ days: 2 }, context());

		expect(report.series).toEqual([
			{ date: "2026-10-20", entries: 4, exits: 0 },
			{ date: TODAY, entries: 0, exits: 2 },
		]);
	});

	it("never counts another company's movements", async () => {
		const { useCase } = build({
			movements: [
				movement({
					companyId: OTHER_COMPANY,
					type: "IN",
					quantity: 10,
					createdAt: NOW,
				}),
				movement({ type: "IN", quantity: 1, createdAt: NOW }),
			],
		});

		const report = await useCase.execute({ days: 1 }, context());

		expect(report.series).toEqual([{ date: TODAY, entries: 1, exits: 0 }]);
	});

	it("answers a single point for days 1", async () => {
		const { useCase } = build({
			movements: [movement({ type: "IN", quantity: 2, createdAt: NOW })],
		});

		const report = await useCase.execute({ days: 1 }, context());

		expect(report.days).toBe(1);
		expect(report.series).toEqual([{ date: TODAY, entries: 2, exits: 0 }]);
	});

	it("answers 90 points starting 89 UTC days before today for days 90", async () => {
		const { useCase } = build();

		const report = await useCase.execute({ days: 90 }, context());

		expect(report.days).toBe(90);
		expect(report.series).toHaveLength(90);
		expect(report.series[0]?.date).toBe("2026-07-24");
		expect(report.series[89]?.date).toBe(TODAY);
	});

	it("reads from the start of the oldest UTC day, with the company in the filter", async () => {
		const { findSince, repository } = spyRepository();
		const useCase = new GetMovementTrendUseCase({
			stockMovementRepository: repository,
			now: () => new Date("2026-10-21T23:59:00.000Z"),
		});

		await useCase.execute({ days: 30 }, context());

		// Today's local time is irrelevant: the range starts at 00:00Z of the
		// oldest day, so a late-evening "now" does not shrink the window.
		expect(findSince).toHaveBeenCalledWith(
			COMPANY,
			new Date("2026-09-22T00:00:00.000Z"),
		);
	});
});
