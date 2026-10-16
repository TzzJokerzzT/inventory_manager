import { Notification } from "../src/domain/entities/notification.js";
import { DomainError } from "../src/domain/errors/domain-error.js";
import { InMemoryNotificationRepository } from "../src/infrastructure/database/in-memory-notification-repository.js";

const BASE = {
	userId: "user-1",
	type: "membership.accepted",
	payload: { membershipId: "membership-1", companyId: "company-1" },
	dedupeKey: "membership.accepted:membership-1",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function notification(
	overrides: {
		id?: string;
		userId?: string;
		dedupeKey?: string;
		readAt?: Date | null;
		createdAt?: Date;
		payload?: Record<string, unknown>;
	} = {},
): Notification {
	return Notification.create({
		id: overrides.id ?? "notification-1",
		userId: overrides.userId ?? "user-1",
		type: "membership.accepted",
		payload: overrides.payload ?? { companyId: "company-1" },
		dedupeKey: overrides.dedupeKey ?? "membership.accepted:membership-1",
		readAt: overrides.readAt ?? null,
		createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
	});
}

describe("Notification entity", () => {
	it("rejects an empty user id", () => {
		expect(() => Notification.create({ ...BASE, userId: "   " })).toThrow(
			DomainError,
		);
	});

	it("rejects an empty type", () => {
		expect(() => Notification.create({ ...BASE, type: "   " })).toThrow(
			DomainError,
		);
	});

	it("rejects an empty dedupe key", () => {
		expect(() => Notification.create({ ...BASE, dedupeKey: "   " })).toThrow(
			DomainError,
		);
	});

	it("rejects a null payload", () => {
		expect(() =>
			Notification.create({
				...BASE,
				payload: null as unknown as Record<string, unknown>,
			}),
		).toThrow(DomainError);
	});

	it("rejects an array payload", () => {
		expect(() =>
			Notification.create({
				...BASE,
				payload: [] as unknown as Record<string, unknown>,
			}),
		).toThrow(DomainError);
	});

	it("defaults the payload to an empty object and the readAt to null", () => {
		const created = Notification.create({
			userId: "user-1",
			type: "membership.accepted",
			dedupeKey: "membership.accepted:membership-1",
		});

		expect(created.payload).toEqual({});
		expect(created.readAt).toBeNull();
		expect(created.id).toEqual(expect.any(String));
		expect(created.createdAt).toBeInstanceOf(Date);
	});

	it("serializes the dates as ISO strings and keeps the payload", () => {
		const createdAt = new Date("2026-01-01T00:00:00.000Z");
		const readAt = new Date("2026-01-02T00:00:00.000Z");
		const created = notification({ createdAt, readAt });

		expect(created.toJSON()).toEqual({
			id: "notification-1",
			userId: "user-1",
			type: "membership.accepted",
			payload: { companyId: "company-1" },
			dedupeKey: "membership.accepted:membership-1",
			readAt: readAt.toISOString(),
			createdAt: createdAt.toISOString(),
		});
	});
});

describe("InMemoryNotificationRepository", () => {
	it("persists a created notification and lists it for its user", async () => {
		const repository = new InMemoryNotificationRepository();

		await repository.create({
			userId: "user-1",
			type: "membership.accepted",
			payload: { membershipId: "membership-1", companyId: "company-1" },
			dedupeKey: "membership.accepted:membership-1",
		});

		const result = await repository.findByUser("user-1");

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			userId: "user-1",
			type: "membership.accepted",
			payload: { membershipId: "membership-1", companyId: "company-1" },
			dedupeKey: "membership.accepted:membership-1",
			readAt: null,
		});
	});

	it("is idempotent: a second write with the same dedupe key records nothing new", async () => {
		const repository = new InMemoryNotificationRepository();

		await repository.create({
			userId: "user-1",
			type: "membership.accepted",
			payload: { membershipId: "membership-1" },
			dedupeKey: "membership.accepted:membership-1",
		});
		await repository.create({
			userId: "user-1",
			type: "membership.accepted",
			payload: { membershipId: "membership-1" },
			dedupeKey: "membership.accepted:membership-1",
		});

		await expect(repository.findByUser("user-1")).resolves.toHaveLength(1);
	});

	it("purges this user's notifications older than the retention window on write", async () => {
		const repository = new InMemoryNotificationRepository();
		const stale = notification({
			id: "stale",
			dedupeKey: "membership.accepted:old",
			createdAt: new Date(Date.now() - 91 * DAY_MS),
		});
		repository.save(stale);

		await repository.create({
			userId: "user-1",
			type: "membership.accepted",
			payload: { membershipId: "membership-1" },
			dedupeKey: "membership.accepted:membership-1",
		});

		const result = await repository.findByUser("user-1");

		expect(result).toHaveLength(1);
		expect(result[0]?.dedupeKey).toBe("membership.accepted:membership-1");
	});

	it("keeps notifications inside the retention window", async () => {
		const repository = new InMemoryNotificationRepository();
		repository.save(
			notification({
				id: "recent",
				dedupeKey: "membership.accepted:recent",
				createdAt: new Date(Date.now() - 89 * DAY_MS),
			}),
		);

		await repository.create({
			userId: "user-1",
			type: "membership.accepted",
			payload: { membershipId: "membership-2" },
			dedupeKey: "membership.accepted:membership-2",
		});

		const result = await repository.findByUser("user-1");

		expect(result.some((item) => item.id === "recent")).toBe(true);
	});

	it("never purges another user's stale rows", async () => {
		const repository = new InMemoryNotificationRepository();
		repository.save(
			notification({
				id: "other-stale",
				userId: "user-2",
				dedupeKey: "membership.accepted:other",
				createdAt: new Date(Date.now() - 200 * DAY_MS),
			}),
		);

		await repository.create({
			userId: "user-1",
			type: "membership.accepted",
			payload: { membershipId: "membership-1" },
			dedupeKey: "membership.accepted:membership-1",
		});

		const other = await repository.findByUser("user-2");

		expect(other.map((item) => item.id)).toEqual(["other-stale"]);
	});

	it("lists notifications newest first", async () => {
		const repository = new InMemoryNotificationRepository();
		repository.save(
			notification({
				id: "older",
				dedupeKey: "membership.accepted:older",
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			}),
		);
		repository.save(
			notification({
				id: "newer",
				dedupeKey: "membership.accepted:newer",
				createdAt: new Date("2026-02-01T00:00:00.000Z"),
			}),
		);

		const result = await repository.findByUser("user-1");

		expect(result.map((item) => item.id)).toEqual(["newer", "older"]);
	});

	it("never returns another user's notifications", async () => {
		const repository = new InMemoryNotificationRepository();
		repository.save(notification({ id: "mine", userId: "user-1" }));
		repository.save(
			notification({
				id: "theirs",
				userId: "user-2",
				dedupeKey: "membership.accepted:theirs",
			}),
		);

		const result = await repository.findByUser("user-1");

		expect(result.map((item) => item.id)).toEqual(["mine"]);
	});

	it("marks only the caller's unread notifications as read and reports the count", async () => {
		const repository = new InMemoryNotificationRepository();
		repository.save(notification({ id: "mine-unread", userId: "user-1" }));
		repository.save(
			notification({
				id: "mine-read",
				userId: "user-1",
				dedupeKey: "membership.accepted:read",
				readAt: new Date("2026-01-03T00:00:00.000Z"),
			}),
		);
		repository.save(
			notification({
				id: "theirs-unread",
				userId: "user-2",
				dedupeKey: "membership.accepted:theirs",
			}),
		);

		const changed = await repository.markAllRead("user-1");

		expect(changed).toBe(1);
		const mine = await repository.findByUser("user-1");
		expect(
			mine.find((item) => item.id === "mine-unread")?.readAt,
		).not.toBeNull();
		// The already-read row keeps its original timestamp; only unread rows move.
		expect(mine.find((item) => item.id === "mine-read")?.readAt).toEqual(
			new Date("2026-01-03T00:00:00.000Z"),
		);
		const theirs = await repository.findByUser("user-2");
		expect(theirs[0]?.readAt).toBeNull();
	});

	it("is idempotent: marking again changes nothing", async () => {
		const repository = new InMemoryNotificationRepository();
		repository.save(notification({ id: "mine-unread", userId: "user-1" }));

		const first = await repository.markAllRead("user-1");
		const second = await repository.markAllRead("user-1");

		expect(first).toBe(1);
		expect(second).toBe(0);
	});
});
