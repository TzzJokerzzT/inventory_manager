import { DomainError } from "../errors/domain-error.js";

/**
 * The event type of the invitation-accepted notification.
 *
 * `type` is stored as free text so a new event kind does not need a migration;
 * this constant is the one value the current code writes, and the read path
 * treats `type` as an opaque discriminator. It is not a union on the entity
 * for that reason: an older deployment must still be able to read a row whose
 * type a newer deployment introduced.
 */
export const MEMBERSHIP_ACCEPTED_NOTIFICATION_TYPE = "membership.accepted";

/** JSON object carried by a notification; its shape depends on `type`. */
export type NotificationPayload = Record<string, unknown>;

export interface NotificationProps {
	id: string;
	userId: string;
	type: string;
	payload: NotificationPayload;
	dedupeKey: string;
	readAt: Date | null;
	createdAt: Date;
}

export interface CreateNotificationProps {
	userId: string;
	type: string;
	payload?: NotificationPayload;
	dedupeKey: string;
	readAt?: Date | null;
	id?: string;
	createdAt?: Date;
}

/**
 * Notification entity.
 *
 * It mirrors the `notifications` table. A notification is an *event* ("X
 * accepted your invitation"), never a pending invitation: the latter is state
 * (`memberships` with `status = INVITED`). The two must not be modelled as
 * each other.
 *
 * `dedupeKey` is the event's identity: the adapter's UNIQUE index turns a
 * retried write into a no-op. `readAt` is nullable on purpose -- NULL means
 * unread -- so there is no second boolean to drift from it. No Prisma or HTTP
 * import belongs in this file.
 */
export class Notification {
	private constructor(private readonly props: NotificationProps) {}

	static create(input: CreateNotificationProps): Notification {
		const userId = input.userId.trim();
		if (userId.length === 0) {
			throw new DomainError("Notification user id must not be empty");
		}

		const type = input.type.trim();
		if (type.length === 0) {
			throw new DomainError("Notification type must not be empty");
		}

		const dedupeKey = input.dedupeKey.trim();
		if (dedupeKey.length === 0) {
			throw new DomainError("Notification dedupe key must not be empty");
		}

		// `=== undefined` and not `??`: an explicit `null` must fail the check,
		// not be silently replaced by an empty object.
		const payload = input.payload === undefined ? {} : input.payload;
		if (
			typeof payload !== "object" ||
			payload === null ||
			Array.isArray(payload)
		) {
			throw new DomainError("Notification payload must be a JSON object");
		}

		return new Notification({
			id: input.id ?? globalThis.crypto.randomUUID(),
			userId,
			type,
			payload,
			dedupeKey,
			readAt: input.readAt ?? null,
			createdAt: input.createdAt ?? new Date(),
		});
	}

	get id(): string {
		return this.props.id;
	}

	get userId(): string {
		return this.props.userId;
	}

	get type(): string {
		return this.props.type;
	}

	get payload(): NotificationPayload {
		return this.props.payload;
	}

	get dedupeKey(): string {
		return this.props.dedupeKey;
	}

	get readAt(): Date | null {
		return this.props.readAt;
	}

	get createdAt(): Date {
		return this.props.createdAt;
	}

	toJSON(): {
		id: string;
		userId: string;
		type: string;
		payload: NotificationPayload;
		dedupeKey: string;
		readAt: string | null;
		createdAt: string;
	} {
		return {
			id: this.id,
			userId: this.userId,
			type: this.type,
			payload: this.payload,
			dedupeKey: this.dedupeKey,
			readAt: this.readAt?.toISOString() ?? null,
			createdAt: this.createdAt.toISOString(),
		};
	}
}
