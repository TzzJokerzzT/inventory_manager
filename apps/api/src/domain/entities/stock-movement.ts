import { DomainError } from "../errors/domain-error.js";

/** The direction of a stock movement: an entry adds, an exit subtracts. */
export type StockMovementType = "IN" | "OUT";

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 1_000_000;
const REASON_MAX_LENGTH = 300;

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

	get createdAt(): Date {
		return this.props.createdAt;
	}

	/**
	 * The movement as stored. The product, the actor and the customer of the
	 * HTTP view are *not* here: they are resolved separately, so the entity
	 * never carries a second copy of rows it does not own.
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
			createdAt: this.createdAt.toISOString(),
		};
	}
}
