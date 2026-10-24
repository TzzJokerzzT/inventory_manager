import { DomainError } from "../errors/domain-error.js";
import {
	formatMeasure,
	formatMoney,
	LotUnit,
	type LotUnitStatus,
	MEASURE_SCALE,
	measureFromNumber,
	moneyFromText,
} from "./lot-unit.js";

/**
 * One purchase is one lot with at most 500 physical units: the cap keeps a
 * single request (and the nested insert it produces) bounded, and no real
 * delivery of measured goods is bigger than that.
 */
export const MAX_LOT_UNITS = 500;

/**
 * The note is a one-line annotation, and it travels to the ledger as the
 * reason of the `IN` movement, so it shares that field's cap.
 */
export const LOT_NOTE_MAX_LENGTH = 300;

/**
 * The largest total the `measure_total` column (`Decimal(12,3)`) can hold,
 * expressed in thousandths.
 */
const MAX_MEASURE_TOTAL_MILLI = 10n ** 12n - 1n;

export interface StockLotProps {
	id: string;
	companyId: string;
	productId: string;
	supplierId: string;
	receivedAt: Date;
	/** `Decimal(12,3)` string: the sum of the units' measures (L6). */
	measureTotal: string;
	/** `Decimal(12,2)` string: the price of one measure. */
	costPerMeasure: string;
	unitCount: number;
	note: string | null;
	createdAt: Date;
	units: LotUnit[];
}

export interface CreateStockLotProps {
	companyId: string;
	productId: string;
	supplierId: string;
	/** Decimal string with the same rule as the product price: > 0. */
	costPerMeasure: string;
	/**
	 * One measure per physical unit, in the product's unit. The client sends
	 * these; `measureTotal` is **never** an input (L6).
	 */
	measures: number[];
	/**
	 * The number of units. It is derived from `measures` when absent and the
	 * entity only asserts it equals the units it built, so a stored row that
	 * disagrees with its own units cannot be read back as an entity.
	 */
	unitCount?: number;
	/** Server-owned default: the lot arrived when it was registered. */
	receivedAt?: Date;
	note?: string | null;
	id?: string;
	createdAt?: Date;
}

function assertIdentifier(value: string, label: string): string {
	const normalized = value.trim();
	if (normalized.length === 0) {
		throw new DomainError(`Stock lot ${label} must not be empty`);
	}

	return normalized;
}

/**
 * Validates the list of measures and returns it in thousandths.
 *
 * Every rule of the request is applied here instead of in the adapter or the
 * controller (L7): at least one unit, at most `MAX_LOT_UNITS`, and each one a
 * positive measure the column can store.
 */
function assertMeasures(raw: number[]): bigint[] {
	if (!Array.isArray(raw)) {
		throw new DomainError("Stock lot units must be a list of measures");
	}

	if (raw.length === 0) {
		throw new DomainError("Stock lot must have at least one unit");
	}

	if (raw.length > MAX_LOT_UNITS) {
		throw new DomainError(
			`Stock lot must have at most ${MAX_LOT_UNITS} units: ${raw.length}`,
		);
	}

	return raw.map((measure) => {
		// Reported before the format check so a negative or zero weight reads as
		// the rule it broke instead of as a malformed decimal.
		if (typeof measure === "number" && measure <= 0) {
			throw new DomainError("Stock lot unit measure must be greater than 0");
		}

		const milli = measureFromNumber(measure);

		if (milli === null) {
			throw new DomainError(
				`Stock lot unit measure must be a decimal with up to nine integer digits and up to three decimals: ${measure}`,
			);
		}

		if (milli <= 0n) {
			throw new DomainError("Stock lot unit measure must be greater than 0");
		}

		return milli;
	});
}

/**
 * Rounds a product of thousandths and cents to whole cents, half up.
 *
 * `measure × costPerMeasure` is `(milli / 1000) × (cents / 100)`, so the raw
 * product still needs to be divided by 1000 to become cents. All operands are
 * non-negative, which is what makes the plain integer division a floor.
 */
function roundToCents(milliTimesCents: bigint): bigint {
	return (milliTimesCents + MEASURE_SCALE / 2n) / MEASURE_SCALE;
}

/** `R-01`, `R-02`, ... from the position of the unit inside the lot. */
function unitCode(index: number): string {
	return `R-${String(index + 1).padStart(2, "0")}`;
}

/**
 * Stock lot entity: one purchase of a measured product (S6).
 *
 * The factory owns the whole arithmetic of S3/L6, so neither the adapter nor
 * the controller can re-implement it differently:
 *
 * - `measureTotal` is **derived** from the units' measures; there is no input
 *   for it.
 * - each unit's `cost` is `measure × costPerMeasure` rounded to two decimals;
 * - the **last unit absorbs the rounding difference**, so the unit costs add up
 *   exactly to `measureTotal × costPerMeasure` and the identity holds by
 *   construction instead of being validated against a typed number.
 *
 * No Express, Prisma or HTTP import belongs in this file.
 */
export class StockLot {
	private constructor(private readonly props: StockLotProps) {}

	static create(input: CreateStockLotProps): StockLot {
		const companyId = assertIdentifier(input.companyId, "company id");
		const productId = assertIdentifier(input.productId, "product id");
		const supplierId = assertIdentifier(input.supplierId, "supplier id");

		const costCents = moneyFromText(input.costPerMeasure);
		if (costCents === null) {
			throw new DomainError(
				`Stock lot cost per measure must be a decimal string with up to ten integer digits and up to two decimals: ${input.costPerMeasure}`,
			);
		}
		if (costCents <= 0n) {
			throw new DomainError(
				"Stock lot cost per measure must be greater than 0",
			);
		}

		const measures = assertMeasures(input.measures);

		const measureTotalMilli = measures.reduce(
			(total, measure) => total + measure,
			0n,
		);
		if (measureTotalMilli > MAX_MEASURE_TOTAL_MILLI) {
			throw new DomainError(
				"Stock lot measure total exceeds the largest supported measure",
			);
		}

		const id = input.id ?? globalThis.crypto.randomUUID();
		const createdAt = input.createdAt ?? new Date();
		const units = allocateUnits({
			lotId: id,
			createdAt,
			measures,
			costCents,
		});

		const unitCount = input.unitCount ?? units.length;
		if (unitCount !== units.length) {
			throw new DomainError(
				`Stock lot unit count must match the number of units: ${unitCount} !== ${units.length}`,
			);
		}

		return new StockLot({
			id,
			companyId,
			productId,
			supplierId,
			receivedAt: input.receivedAt ?? createdAt,
			measureTotal: formatMeasure(measureTotalMilli),
			costPerMeasure: formatMoney(costCents),
			unitCount,
			note: normalizeNote(input.note),
			createdAt,
			units,
		});
	}

	get id(): string {
		return this.props.id;
	}

	get companyId(): string {
		return this.props.companyId;
	}

	get productId(): string {
		return this.props.productId;
	}

	get supplierId(): string {
		return this.props.supplierId;
	}

	get receivedAt(): Date {
		return this.props.receivedAt;
	}

	get measureTotal(): string {
		return this.props.measureTotal;
	}

	get costPerMeasure(): string {
		return this.props.costPerMeasure;
	}

	get unitCount(): number {
		return this.props.unitCount;
	}

	get note(): string | null {
		return this.props.note;
	}

	get createdAt(): Date {
		return this.props.createdAt;
	}

	get units(): readonly LotUnit[] {
		return this.props.units;
	}

	toJSON(): {
		id: string;
		companyId: string;
		productId: string;
		supplierId: string;
		receivedAt: string;
		measureTotal: string;
		costPerMeasure: string;
		unitCount: number;
		note: string | null;
		createdAt: string;
		units: ReturnType<LotUnit["toJSON"]>[];
	} {
		return {
			id: this.id,
			companyId: this.companyId,
			productId: this.productId,
			supplierId: this.supplierId,
			receivedAt: this.receivedAt.toISOString(),
			measureTotal: this.measureTotal,
			costPerMeasure: this.costPerMeasure,
			unitCount: this.unitCount,
			note: this.note,
			createdAt: this.createdAt.toISOString(),
			units: this.props.units.map((unit) => unit.toJSON()),
		};
	}
}

/**
 * Builds the units of the lot with the cost allocation of S3.
 *
 * The total is computed from `measureTotal × costPerMeasure`, **not** from the
 * sum of the rounded unit costs: that is what makes the invoice figure the
 * authority. Every unit but the last is rounded on its own, and the last one
 * receives whatever is left, so the returned costs add up to the total exactly.
 */
function allocateUnits(options: {
	lotId: string;
	createdAt: Date;
	measures: bigint[];
	costCents: bigint;
}): LotUnit[] {
	const lastIndex = options.measures.length - 1;
	const measureTotalMilli = options.measures.reduce(
		(total, measure) => total + measure,
		0n,
	);
	const totalCents = roundToCents(measureTotalMilli * options.costCents);

	const costs = options.measures.map((measure) =>
		roundToCents(measure * options.costCents),
	);
	const absorbed =
		totalCents -
		costs.slice(0, lastIndex).reduce((total, cost) => total + cost, 0n);

	if (absorbed < 0n) {
		// A negative share is not representable: the roundings of the other units
		// already exceed the lot's cost. Report it instead of storing a unit with
		// a cost nobody could explain.
		throw new DomainError(
			"Stock lot unit costs cannot be allocated: the rounding leaves the last unit with a negative cost",
		);
	}

	return options.measures.map((measure, index) =>
		LotUnit.create({
			lotId: options.lotId,
			code: unitCode(index),
			measure: formatMeasure(measure),
			cost: formatMoney(index === lastIndex ? absorbed : costs[index]),
			status: "AVAILABLE" satisfies LotUnitStatus,
			createdAt: options.createdAt,
		}),
	);
}

/**
 * Normalizes the optional note: absent, `null` and whitespace-only all mean
 * "no note", so "the client cleared the box" and "the client never sent the
 * field" cannot produce two different stored values.
 */
function normalizeNote(raw: string | null | undefined): string | null {
	if (raw === null || raw === undefined) {
		return null;
	}

	const value = raw.trim();
	if (value.length === 0) {
		return null;
	}

	if (value.length > LOT_NOTE_MAX_LENGTH) {
		throw new DomainError(
			`Stock lot note must be at most ${LOT_NOTE_MAX_LENGTH} characters`,
		);
	}

	return value;
}
