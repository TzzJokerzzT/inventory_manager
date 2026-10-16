import { Notification } from "../src/domain/entities/notification.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaNotificationRepository } from "../src/infrastructure/database/prisma-notification-repository.js";

/**
 * The adapter talks to the `notification` delegate plus `$transaction`, so the
 * fake narrows the injected surface to what it calls. It is a hand-written
 * double: no database and no generated client runtime is loaded here.
 */
type NotificationDelegate = Pick<PrismaClient, "notification" | "$transaction">;

function buildFakeDelegate() {
	const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
	const createMany = jest.fn().mockResolvedValue({ count: 1 });
	const findMany = jest.fn();
	const updateMany = jest.fn();

	const delegate = {
		notification: { deleteMany, createMany, findMany, updateMany },
		$transaction: jest.fn().mockResolvedValue([]),
	} as unknown as NotificationDelegate;

	return { delegate, deleteMany, createMany, findMany, updateMany };
}

const ROW = {
	id: "notification-1",
	userId: "user-1",
	type: "membership.accepted",
	payload: { membershipId: "membership-1", companyId: "company-1" },
	dedupeKey: "membership.accepted:membership-1",
	readAt: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const DAY_MS = 24 * 60 * 60 * 1000;

describe("PrismaNotificationRepository", () => {
	it("writes the insert and the purge in one transaction", async () => {
		const { delegate, deleteMany, createMany } = buildFakeDelegate();
		const repository = new PrismaNotificationRepository({ prisma: delegate });

		await repository.create({
			userId: "user-1",
			type: "membership.accepted",
			payload: { membershipId: "membership-1", companyId: "company-1" },
			dedupeKey: "membership.accepted:membership-1",
		});

		expect(delegate.$transaction).toHaveBeenCalledTimes(1);
		expect(deleteMany).toHaveBeenCalledTimes(1);
		expect(createMany).toHaveBeenCalledTimes(1);
	});

	it("purges only this user's rows older than the retention window", async () => {
		const { delegate, deleteMany } = buildFakeDelegate();
		const repository = new PrismaNotificationRepository({ prisma: delegate });
		const before = Date.now();

		await repository.create({
			userId: "user-1",
			type: "membership.accepted",
			payload: { membershipId: "membership-1" },
			dedupeKey: "membership.accepted:membership-1",
		});

		const where = deleteMany.mock.calls[0][0].where;
		expect(where.userId).toBe("user-1");
		expect(where.createdAt.lt).toBeInstanceOf(Date);
		// The cutoff is 90 days before "now", within the window this call could
		// have observed.
		const cutoff = where.createdAt.lt.getTime();
		expect(cutoff).toBeGreaterThanOrEqual(before - 90 * DAY_MS);
		expect(cutoff).toBeLessThan(before - 90 * DAY_MS + 5_000);
	});

	it("tolerates the unique conflict instead of failing the write", async () => {
		const { delegate, createMany } = buildFakeDelegate();
		const repository = new PrismaNotificationRepository({ prisma: delegate });

		await repository.create({
			userId: "user-1",
			type: "membership.accepted",
			payload: { membershipId: "membership-1", companyId: "company-1" },
			dedupeKey: "membership.accepted:membership-1",
		});

		expect(createMany).toHaveBeenCalledWith({
			data: [
				expect.objectContaining({
					userId: "user-1",
					type: "membership.accepted",
					dedupeKey: "membership.accepted:membership-1",
					payload: { membershipId: "membership-1", companyId: "company-1" },
					readAt: null,
				}),
			],
			skipDuplicates: true,
		});
	});

	it("lists a user's rows newest first, scoped in the WHERE clause", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([ROW]);

		const repository = new PrismaNotificationRepository({ prisma: delegate });
		const result = await repository.findByUser("user-1");

		expect(findMany).toHaveBeenCalledWith({
			where: { userId: "user-1" },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(Notification);
		expect(result[0]).toMatchObject({
			id: "notification-1",
			userId: "user-1",
			type: "membership.accepted",
			readAt: null,
		});
	});

	it("maps rows into domain entities, never raw Prisma rows", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([{ ...ROW, extraColumn: "leak-me-not" }]);

		const repository = new PrismaNotificationRepository({ prisma: delegate });
		const result = await repository.findByUser("user-1");

		expect(result[0]).toBeInstanceOf(Notification);
		expect(JSON.parse(JSON.stringify(result[0]))).not.toHaveProperty(
			"extraColumn",
		);
	});

	it("marks only the caller's unread rows as read", async () => {
		const { delegate, updateMany } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 2 });

		const repository = new PrismaNotificationRepository({ prisma: delegate });
		const changed = await repository.markAllRead("user-1");

		expect(updateMany).toHaveBeenCalledWith({
			where: { userId: "user-1", readAt: null },
			data: { readAt: expect.any(Date) },
		});
		expect(changed).toBe(2);
	});
});
