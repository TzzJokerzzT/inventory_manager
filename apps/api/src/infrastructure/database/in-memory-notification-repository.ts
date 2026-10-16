import { Notification } from "../../domain/entities/notification.js";
import {
	type CreateNotificationInput,
	NOTIFICATION_RETENTION_DAYS,
	type NotificationRepository,
} from "../../domain/repositories/notification-repository.js";

const RETENTION_MS = NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * In-memory adapter for the {@link NotificationRepository} port.
 *
 * It exists so the use cases and the HTTP tests run without a database. It
 * applies the same dedupe-on-`dedupeKey` rule and the same opportunistic
 * 90-day purge as the Prisma adapter, so the two stay interchangeable behind
 * the port.
 */
export class InMemoryNotificationRepository implements NotificationRepository {
	private readonly notifications = new Map<string, Notification>();

	constructor(notifications: Notification[] = []) {
		for (const notification of notifications) {
			this.notifications.set(notification.id, notification);
		}
	}

	async create(input: CreateNotificationInput): Promise<void> {
		const notification = Notification.create(input);
		const cutoff = Date.now() - RETENTION_MS;

		// Mirrors the Prisma adapter's transaction: purge this user's stale
		// rows (the retention mechanism, no cron), then insert. Rows of other
		// users are never touched.
		for (const [id, existing] of this.notifications) {
			if (
				existing.userId === notification.userId &&
				existing.createdAt.getTime() < cutoff
			) {
				this.notifications.delete(id);
			}
		}

		// Same UNIQUE `dedupe_key` rule as the database: an event already
		// recorded is a no-op, never a second notification.
		const alreadyRecorded = Array.from(this.notifications.values()).some(
			(existing) => existing.dedupeKey === notification.dedupeKey,
		);
		if (alreadyRecorded) {
			return;
		}

		this.notifications.set(notification.id, notification);
	}

	async findByUser(userId: string): Promise<Notification[]> {
		// Same `userId` scoping and newest-first order as the Prisma adapter's
		// index, so one user's events never appear in another's list.
		return Array.from(this.notifications.values())
			.filter((notification) => notification.userId === userId)
			.sort(
				(a, b) =>
					b.createdAt.getTime() - a.createdAt.getTime() ||
					b.id.localeCompare(a.id),
			);
	}

	async markAllRead(userId: string): Promise<number> {
		let count = 0;

		for (const [id, existing] of this.notifications) {
			if (existing.userId !== userId || existing.readAt !== null) {
				continue;
			}

			// The entity is immutable, so marking read builds the next state
			// and replaces the row under the same id.
			this.notifications.set(
				id,
				Notification.create({
					id: existing.id,
					userId: existing.userId,
					type: existing.type,
					payload: existing.payload,
					dedupeKey: existing.dedupeKey,
					readAt: new Date(),
					createdAt: existing.createdAt,
				}),
			);
			count += 1;
		}

		return count;
	}

	/** Adapter-specific: lets the test suite insert notifications directly. */
	save(notification: Notification): void {
		this.notifications.set(notification.id, notification);
	}
}
