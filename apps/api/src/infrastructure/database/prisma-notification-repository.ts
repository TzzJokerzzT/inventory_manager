import {
	Notification,
	type NotificationPayload,
} from "../../domain/entities/notification.js";
import {
	type CreateNotificationInput,
	NOTIFICATION_RETENTION_DAYS,
	type NotificationRepository,
} from "../../domain/repositories/notification-repository.js";
import type {
	Notification as NotificationModel,
	Prisma,
	PrismaClient,
} from "./generated/prisma/client.js";

/**
 * The adapter depends on the `notification` delegate plus `$transaction`, and
 * on the `Prisma` namespace only for the JSON input type. The import is
 * type-only on purpose: the generated client is ESM-first and Jest runs
 * through `@swc/jest` in CommonJS, so a runtime import would break the test
 * suite.
 */
type NotificationDelegate = Pick<PrismaClient, "notification" | "$transaction">;

const RETENTION_MS = NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface PrismaNotificationRepositoryDependencies {
	prisma: NotificationDelegate;
}

/**
 * Prisma-backed adapter for the {@link NotificationRepository} port.
 *
 * Rows are always mapped back to the domain entity; a raw Prisma object never
 * crosses the port boundary.
 */
export class PrismaNotificationRepository implements NotificationRepository {
	private readonly prisma: NotificationDelegate;

	constructor(dependencies: PrismaNotificationRepositoryDependencies) {
		this.prisma = dependencies.prisma;
	}

	async create(input: CreateNotificationInput): Promise<void> {
		const notification = Notification.create(input);
		const cutoff = new Date(Date.now() - RETENTION_MS);

		// Two statements, one transaction, both scoped to this user:
		// - the delete is the whole retention mechanism (no cron exists); it
		//   rides on the write that creates the event.
		// - `createMany` + `skipDuplicates` turns the UNIQUE `dedupe_key`
		//   conflict into a no-op, so a replayed accept records nothing new
		//   instead of failing.
		await this.prisma.$transaction([
			this.prisma.notification.deleteMany({
				where: {
					userId: notification.userId,
					createdAt: { lt: cutoff },
				},
			}),
			this.prisma.notification.createMany({
				data: [
					{
						id: notification.id,
						userId: notification.userId,
						type: notification.type,
						payload: notification.payload as Prisma.InputJsonValue,
						dedupeKey: notification.dedupeKey,
						readAt: null,
						createdAt: notification.createdAt,
					},
				],
				skipDuplicates: true,
			}),
		]);
	}

	async findByUser(userId: string): Promise<Notification[]> {
		// The `userId` filter travels in the WHERE clause, so the database --
		// not the mapping code -- keeps one user's events out of another's
		// list. The order matches `notifications_user_id_created_at_idx`.
		const rows = await this.prisma.notification.findMany({
			where: { userId },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});

		return rows.map((row) => this.toDomain(row));
	}

	async markAllRead(userId: string): Promise<number> {
		// `readAt: null` means "unread"; the user filter is the scoping rule.
		const { count } = await this.prisma.notification.updateMany({
			where: { userId, readAt: null },
			data: { readAt: new Date() },
		});

		return count;
	}

	/** Maps a raw Prisma row back into the domain entity. */
	private toDomain(row: NotificationModel): Notification {
		return Notification.create({
			id: row.id,
			userId: row.userId,
			type: row.type,
			// `payload` is a JSONB column, so the database does not narrow it to
			// an object; the entity's validation is the runtime guard.
			payload: row.payload as NotificationPayload,
			dedupeKey: row.dedupeKey,
			readAt: row.readAt,
			createdAt: row.createdAt,
		});
	}
}
