import type {
	Notification,
	NotificationPayload,
} from "../entities/notification.js";

/**
 * How long a notification is kept before the opportunistic purge removes it.
 *
 * Ninety days is the retention decision: no cron exists, so the sweep rides on
 * the write that creates a notification. A user who is never notified again
 * keeps their old rows, which is the accepted cost of not running a timer.
 */
export const NOTIFICATION_RETENTION_DAYS = 90;

export interface CreateNotificationInput {
	/** The user who will see the notification, i.e. the event's audience. */
	userId: string;
	/** The event kind, e.g. `membership.accepted`. */
	type: string;
	/** JSON context the reader needs; its shape depends on `type`. */
	payload?: NotificationPayload;
	/** Stable key derived from the event; the UNIQUE index dedupes on it. */
	dedupeKey: string;
}

/**
 * Port for notification persistence.
 *
 * This is an interface only: `application` and `domain` depend on this
 * abstraction, and `infrastructure` provides the concrete implementation.
 * Notifications are events and live in their own table, apart from
 * `memberships`, which is state.
 */
export interface NotificationRepository {
	/**
	 * Persists one notification, idempotently.
	 *
	 * The write is keyed on `dedupeKey`: a retry, a double click or a replayed
	 * request must be a no-op, never a second notification, so the adapter
	 * tolerates the UNIQUE conflict instead of failing the caller. A conflict
	 * is not an error -- the event was already recorded.
	 *
	 * The same write opportunistically purges the audience's notifications
	 * older than `NOTIFICATION_RETENTION_DAYS`, scoped to that user, in the
	 * same statement/transaction as the insert. That is the whole retention
	 * mechanism: there is no cron and no timer, so a process that never writes
	 * again never sweeps.
	 */
	create(input: CreateNotificationInput): Promise<void>;

	/**
	 * Lists the given user's notifications, newest first.
	 *
	 * The `userId` is part of the query, not a filter applied afterwards, so a
	 * caller can never observe another user's events. The ordering is the
	 * index's `(user_id, created_at DESC)` order.
	 */
	findByUser(userId: string): Promise<Notification[]>;

	/**
	 * Marks every unread notification of the given user as read.
	 *
	 * Scoped to the user for the same reason as `findByUser`: a caller only
	 * ever touches their own rows, and an id from a request is never trusted.
	 * Returns how many rows changed, which the caller may ignore; the count
	 * exists so the operation is observable.
	 */
	markAllRead(userId: string): Promise<number>;
}
