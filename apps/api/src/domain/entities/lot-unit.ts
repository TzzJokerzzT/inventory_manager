import { DomainError } from "../errors/domain-error.js";

/**
 * A physical unit of a lot is either still in stock or already sold (S2: whole
 * units, never a fraction of one).
 */
export type LotUnitStatus = "AVAILABLE" | "SOLD";

const CODE_MAX_LENGTH = 32;

/**
 * `measure` is `Decimal(12,3)`: up to nine integer digits and up to three
 * decimals. It travels as a **string** for the same reason the product price
 * does -- the column is exact and a float is not.
 */
const MEASURE_PATTERN = /^(\d{1,9})(?:\.(\d{1,3}))?$/;

/** `cost` is `Decimal(12,2)`: up to ten integer digits and up to two decimals. */
const MONEY_PATTERN = /^(\d{1,10})(?:\.(\d{1,2}))?$/;

/** One measure expressed in thousandths: the column's smallest step. */
export const MEASURE_SCALE = 1000n;

/** One money amount expressed in cents: the column's smallest step. */
export const MONEY_SCALE = 100n;

/**
 * Reads a measure written as a decimal string, or `null` when it is not
 * representable in `Decimal(12,3)`.
 */
export function measureFromText(raw: string): bigint | null {
	const match = MEASURE_PATTERN.exec(raw.trim());
	if (match === null) {
		return null;
	}

	return (
		BigInt(match[1]) * MEASURE_SCALE + BigInt((match[2] ?? "").padEnd(3, "0"))
	);
}

/**
 * Reads a measure the client sent as a JSON number, or `null` when it is not
 * representable in `Decimal(12,3)`.
 *
 * The number is read through its own decimal notation (`String(84.5)` ->
 * `"84.5"`), never multiplied by a power of ten: `84.5 * 1000` is not
 * guaranteed to be the integer 84500, while the text is exact. A value written
 * in exponential notation (`1e-7`) simply does not match the pattern, which is
 * the correct answer -- it has more precision than the column stores.
 */
export function measureFromNumber(raw: number): bigint | null {
	if (!Number.isFinite(raw)) {
		return null;
	}

	return measureFromText(String(raw));
}

/**
 * Reads a money amount written as a decimal string, or `null` when it is not
 * representable in `Decimal(12,2)`.
 */
export function moneyFromText(raw: string): bigint | null {
	const match = MONEY_PATTERN.exec(raw.trim());
	if (match === null) {
		return null;
	}

	return (
		BigInt(match[1]) * MONEY_SCALE + BigInt((match[2] ?? "").padEnd(2, "0"))
	);
}

/** Writes a measure in thousandths as the `Decimal(12,3)` string `"12.500"`. */
export function formatMeasure(value: bigint): string {
	return formatScaled(value, MEASURE_SCALE, 3);
}

/** Writes an amount in cents as the `Decimal(12,2)` string `"150.00"`. */
export function formatMoney(value: bigint): string {
	return formatScaled(value, MONEY_SCALE, 2);
}

function formatScaled(value: bigint, scale: bigint, decimals: number): string {
	const integer = value / scale;
	const fraction = (value % scale).toString().padStart(decimals, "0");

	return `${integer}.${fraction}`;
}

export interface LotUnitProps {
	id: string;
	lotId: string;
	code: string;
	/** `Decimal(12,3)` string, always positive. */
	measure: string;
	/** `Decimal(12,2)` string: this unit's share of the lot's cost. */
	cost: string;
	status: LotUnitStatus;
	createdAt: Date;
}

export interface CreateLotUnitProps {
	lotId: string;
	code: string;
	measure: string;
	cost: string;
	status?: LotUnitStatus;
	id?: string;
	createdAt?: Date;
}

function assertIdentifier(value: string, label: string): string {
	const normalized = value.trim();
	if (normalized.length === 0) {
		throw new DomainError(`Lot unit ${label} must not be empty`);
	}

	return normalized;
}

function assertCode(code: string): string {
	const normalized = code.trim();
	if (normalized.length === 0) {
		throw new DomainError("Lot unit code must not be empty");
	}
	if (normalized.length > CODE_MAX_LENGTH) {
		throw new DomainError(
			`Lot unit code must be at most ${CODE_MAX_LENGTH} characters`,
		);
	}

	return normalized;
}

/**
 * Validates and normalizes the unit's measure: a positive `Decimal(12,3)`.
 * Rounding from the request's floats never happens here -- a value with more
 * precision than the column stores is a mistake to report, not to round.
 */
function assertMeasure(measure: string): string {
	const value = measureFromText(measure);
	if (value === null) {
		throw new DomainError(
			`Lot unit measure must be a decimal with up to nine integer digits and up to three decimals: ${measure}`,
		);
	}
	if (value <= 0n) {
		throw new DomainError("Lot unit measure must be greater than 0");
	}

	return formatMeasure(value);
}

/**
 * Validates and normalizes the unit's cost. Zero is valid: a unit whose share
 * of the lot rounds below one cent costs nothing, and the identity that matters
 * -- the units add up to the lot -- still holds.
 */
function assertCost(cost: string): string {
	const value = moneyFromText(cost);
	if (value === null) {
		throw new DomainError(
			`Lot unit cost must be a decimal string with up to ten integer digits and up to two decimals: ${cost}`,
		);
	}
	if (value < 0n) {
		throw new DomainError("Lot unit cost must not be negative");
	}

	return formatMoney(value);
}

function assertStatus(status: LotUnitStatus): LotUnitStatus {
	if (status !== "AVAILABLE" && status !== "SOLD") {
		throw new DomainError(
			`Lot unit status must be AVAILABLE or SOLD: ${status}`,
		);
	}

	return status;
}

/**
 * One physical unit of a purchase lot -- a roll, for example (S3, S6).
 *
 * The factory validates every invariant before an instance can exist, so an
 * invalid unit is not representable: non-empty ids, a code (1..32 after trim),
 * a positive measure in `Decimal(12,3)` and a non-negative cost in
 * `Decimal(12,2)`, both stored as normalized decimal strings. The **cost of the
 * unit is its own**, derived from its own measure, which is the whole point of
 * S3: two rolls of the same lot with different weights do not cost the same.
 *
 * Whether the prices add up to the lot is not this factory's rule: the
 * allocation lives in `StockLot`, the only place that knows the total.
 */
export class LotUnit {
	private constructor(private readonly props: LotUnitProps) {}

	static create(input: CreateLotUnitProps): LotUnit {
		return new LotUnit({
			id: input.id ?? globalThis.crypto.randomUUID(),
			lotId: assertIdentifier(input.lotId, "lot id"),
			code: assertCode(input.code),
			measure: assertMeasure(input.measure),
			cost: assertCost(input.cost),
			status: assertStatus(input.status ?? "AVAILABLE"),
			createdAt: input.createdAt ?? new Date(),
		});
	}

	get id(): string {
		return this.props.id;
	}

	get lotId(): string {
		return this.props.lotId;
	}

	get code(): string {
		return this.props.code;
	}

	get measure(): string {
		return this.props.measure;
	}

	get cost(): string {
		return this.props.cost;
	}

	get status(): LotUnitStatus {
		return this.props.status;
	}

	get createdAt(): Date {
		return this.props.createdAt;
	}

	/**
	 * The same unit with a new status, as a **new instance**.
	 *
	 * A unit is immutable, so the sale does not edit the row it read: it builds
	 * the next state, the same way `Product.withStock` does for the stock.
	 */
	withStatus(status: LotUnitStatus): LotUnit {
		return new LotUnit({ ...this.props, status: assertStatus(status) });
	}

	/**
	 * The unit as the contract exposes it. `lotId` and `createdAt` stay out: the
	 * unit is always answered inside its lot, which already carries both.
	 */
	toJSON(): {
		id: string;
		code: string;
		measure: string;
		cost: string;
		status: LotUnitStatus;
	} {
		return {
			id: this.id,
			code: this.code,
			measure: this.measure,
			cost: this.cost,
			status: this.status,
		};
	}
}
