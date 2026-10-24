import { DomainError } from "../errors/domain-error.js";
import { formatMoney, moneyFromText } from "./lot-unit.js";

/** The direction of a stock movement: an entry adds, an exit subtracts. */
export type StockMovementType = "IN" | "OUT";

/**
 * A sale takes whole units (S2) and a purchase lot holds at most 500 of them,
 * so a single movement can never name more units than a lot can carry.
 */
export const MAX_MOVEMENT_UNITS = 500;

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 1_000_000;
const REASON_MAX_LENGTH = 300;

/**
 * One physical unit a movement took out, as the readings expose it.
 *
 * `code` and `measure` identify the roll, and `cost` is **that roll's own**
 * share of the lot (S3): the sale's margin is the written price minus the sum
 * of the costs of the units it took, never an average of the catalogue.
 */
export interface StockMovementUnit {
	id: string;
	code: string;
	/** `Decimal(12,3)` string. */
	measure: string;
	/** `Decimal(12,2)` string: this unit's own cost. */
	cost: string;
}

/** The fields a persisted movement has. */
export interface StockMovementProps {
	id: string;
	companyId: string;
	productId: string;
	type: StockMovementType;
	quantity: number;
	reason: string | null;
	userId: string;
	/** The customer of a sale, or `null` for an anonymous exit or any entry. */
	customerId: string | null;
	/** The lot an entry brought in, or `null` for an exit (S6). */
	lotId: string | null;
	/** The price actually charged in this sale, or `null` (S1, S9). */
	unitPrice: string | null;
	/**
	 * The physical units the movement took, as `movement_units` links them. They
	 * are relation rows, not columns, which is why they are read back through the
	 * port instead of appearing in {@link StockMovement.toJSON}.
	 */
	unitIds: string[];
	createdAt: Date;
}

export interface CreateStockMovementProps {
	companyId: string;
	productId: string;
	/** `IN` adds `quantity` to the stock, `OUT` subtracts it. */
	type: StockMovementType;
	/** Always positive: the direction lives in `type`, never in the sign. */
	quantity: number;
	/** Server-owned: the caller comes from the token, never from the body. */
	userId: string;
	reason?: string | null;
	/**
	 * The customer the sale is associated with. Only an `OUT` may carry one; the
	 * use case enforces that rule, the entity only normalizes the id.
	 */
	customerId?: string | null;
	/**
	 * The purchase lot this entry brought in (S6). Only an `IN` created by the lot
	 * registration carries one; the entity only normalizes the id.
	 */
	lotId?: string | null;
	/**
	 * The price written on the sale (S1). It is the same rule as the product
	 * price -- a positive `Decimal(12,2)` string -- and `null` means the price was
	 * not written, which is the case of every movement older than the field (S9).
	 */
	unitPrice?: string | null;
	/**
	 * The whole units the sale takes (S2). Which units are legal is the adapter's
	 * rule, because it depends on the store; the entity only normalizes the list.
	 */
	unitIds?: string[];
	id?: string;
	/** Server-owned: movements are never backdated by a client. */
	createdAt?: Date;
}

function assertIdentifier(value: string, label: string): string {
	const normalized = value.trim();
	if (normalized.length === 0) {
		throw new DomainError(`Stock movement ${label} must not be empty`);
	}

	return normalized;
}

function assertType(type: StockMovementType): StockMovementType {
	if (type !== "IN" && type !== "OUT") {
		throw new DomainError(`Stock movement type must be IN or OUT: ${type}`);
	}

	return type;
}

function assertQuantity(quantity: number): number {
	if (
		!Number.isInteger(quantity) ||
		quantity < QUANTITY_MIN ||
		quantity > QUANTITY_MAX
	) {
		throw new DomainError(
			`Stock movement quantity must be an integer between ${QUANTITY_MIN} and ${QUANTITY_MAX}: ${quantity}`,
		);
	}

	return quantity;
}

function normalizeReason(reason: string | null | undefined): string | null {
	if (reason === null || reason === undefined) {
		return null;
	}

	const value = reason.trim();
	if (value.length === 0) {
		return null;
	}

	if (value.length > REASON_MAX_LENGTH) {
		throw new DomainError(
			`Stock movement reason must be at most ${REASON_MAX_LENGTH} characters`,
		);
	}

	return value;
}

/**
 * Normalizes an optional reference to another row: absent and whitespace-only
 * values are stored as `null`, so "no row" has exactly one representation.
 */
function normalizeOptionalId(value: string | null | undefined): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	const normalized = value.trim();

	return normalized.length === 0 ? null : normalized;
}

/**
 * Normalizes the price written on the sale.
 *
 * Absent, `null` and blank all mean "no price": that is the state of every
 * movement recorded before the field existed, and inventing a value for them is
 * exactly what S9 forbids. A present one is read with the product price's rule
 * (`Decimal(12,2)`, positive) and stored padded to two decimals.
 */
function normalizeUnitPrice(raw: string | null | undefined): string | null {
	if (raw === null || raw === undefined) {
		return null;
	}

	const value = raw.trim();
	if (value.length === 0) {
		return null;
	}

	const cents = moneyFromText(value);
	if (cents === null) {
		throw new DomainError(
			`Stock movement unit price must be a decimal string with up to ten integer digits and up to two decimals: ${raw}`,
		);
	}
	if (cents <= 0n) {
		throw new DomainError("Stock movement unit price must be greater than 0");
	}

	return formatMoney(cents);
}

/**
 * Normalizes the units a sale takes: a trimmed, non-repeated list of ids that
 * never exceeds what a lot can hold.
 *
 * The rule that the list is *required*, and that it matches `quantity`, is not
 * here: it depends on whether the product has available units, which only the
 * store can answer (L9, L10).
 */
function assertUnitIds(raw: string[] | undefined): string[] {
	if (raw === undefined) {
		return [];
	}

	if (!Array.isArray(raw)) {
		throw new DomainError("Stock movement unit ids must be a list of ids");
	}

	if (raw.length > MAX_MOVEMENT_UNITS) {
		throw new DomainError(
			`Stock movement must take at most ${MAX_MOVEMENT_UNITS} units: ${raw.length}`,
		);
	}

	const ids = raw.map((id) => {
		if (typeof id !== "string" || id.trim().length === 0) {
			throw new DomainError("Stock movement unit id must not be empty");
		}

		return id.trim();
	});

	if (new Set(ids).size !== ids.length) {
		throw new DomainError("Stock movement unit ids must not repeat a unit");
	}

	return ids;
}

/**
 * Stock movement entity: one immutable entry of the stock audit trail
 * (MOV-05).
 *
 * The factory validates every invariant before an instance can exist, so an
 * invalid movement is not representable: non-empty ids, a type in `IN|OUT`, a
 * quantity that is an integer in `1..1_000_000`, a trimmed reason of at most
 * 300 characters (empty means "no reason") and a server-owned `createdAt`.
 * The optional `customerId` is trimmed and an empty one becomes `null`; whether
 * a customer is allowed at all is the use case's rule (only exits). The
 * optional `lotId` is normalized the same way and only the lot registration
 * sets it: an entry is the movement of a purchase lot (S6).
 *
 * The **price written on the sale** (S1) is a positive `Decimal(12,2)` string
 * or `null`, and the units it took (S2) are a normalized list of ids: the
 * entity carries both because they belong to the movement, but it does not
 * decide which units a sale may take -- that depends on the store and lives in
 * the adapter (L10).
 *
 * There is no mutator on purpose: a movement is never edited nor deleted, it
 * is the trace of what happened to the stock. No Express, Prisma or HTTP
 * import belongs in this file.
 */
export class StockMovement {
	private constructor(private readonly props: StockMovementProps) {}

	static create(input: CreateStockMovementProps): StockMovement {
		return new StockMovement({
			id: assertIdentifier(input.id ?? globalThis.crypto.randomUUID(), "id"),
			companyId: assertIdentifier(input.companyId, "company id"),
			productId: assertIdentifier(input.productId, "product id"),
			type: assertType(input.type),
			quantity: assertQuantity(input.quantity),
			reason: normalizeReason(input.reason),
			userId: assertIdentifier(input.userId, "user id"),
			customerId: normalizeOptionalId(input.customerId),
			lotId: normalizeOptionalId(input.lotId),
			unitPrice: normalizeUnitPrice(input.unitPrice),
			unitIds: assertUnitIds(input.unitIds),
			createdAt: input.createdAt ?? new Date(),
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

	get type(): StockMovementType {
		return this.props.type;
	}

	get quantity(): number {
		return this.props.quantity;
	}

	get reason(): string | null {
		return this.props.reason;
	}

	get userId(): string {
		return this.props.userId;
	}

	get customerId(): string | null {
		return this.props.customerId;
	}

	get lotId(): string | null {
		return this.props.lotId;
	}

	get unitPrice(): string | null {
		return this.props.unitPrice;
	}

	get unitIds(): readonly string[] {
		return this.props.unitIds;
	}

	get createdAt(): Date {
		return this.props.createdAt;
	}

	/**
	 * The movement as stored. The product, the actor and the customer of the
	 * HTTP view are *not* here: they are resolved separately, so the entity
	 * never carries a second copy of rows it does not own. The units it took are
	 * relation rows too, and they are read through the port.
	 */
	toJSON(): {
		id: string;
		companyId: string;
		productId: string;
		type: StockMovementType;
		quantity: number;
		reason: string | null;
		userId: string;
		customerId: string | null;
		lotId: string | null;
		unitPrice: string | null;
		createdAt: string;
	} {
		return {
			id: this.id,
			companyId: this.companyId,
			productId: this.productId,
			type: this.type,
			quantity: this.quantity,
			reason: this.reason,
			userId: this.userId,
			customerId: this.customerId,
			lotId: this.lotId,
			unitPrice: this.unitPrice,
			createdAt: this.createdAt.toISOString(),
		};
	}
}
