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
 * Stock movement entity: one immutable entry of the stock audit trail
 * (MOV-05).
 *
 * The factory validates every invariant before an instance can exist, so an
 * invalid movement is not representable: non-empty ids, a type in `IN|OUT`, a
 * quantity that is an integer in `1..1_000_000`, a trimmed reason of at most
 * 300 characters (empty means "no reason") and a server-owned `createdAt`.
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

	get createdAt(): Date {
		return this.props.createdAt;
	}

	/**
	 * The movement as stored. The product and the actor of the HTTP view are
	 * *not* here: they are resolved separately, so the entity never carries a
	 * second copy of rows it does not own.
	 */
	toJSON(): {
		id: string;
		companyId: string;
		productId: string;
		type: StockMovementType;
		quantity: number;
		reason: string | null;
		userId: string;
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
			createdAt: this.createdAt.toISOString(),
		};
	}
}
