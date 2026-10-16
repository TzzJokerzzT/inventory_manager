import { MarkNotificationsReadUseCase } from "../src/application/use-cases/mark-notifications-read.js";
import { Notification } from "../src/domain/entities/notification.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryNotificationRepository } from "../src/infrastructure/database/in-memory-notification-repository.js";

const USER_ID = "user-1";

function buildUser(id = USER_ID): User {
	return User.create({
		id,
		auth0Sub: `auth0|${id}`,
		email: `${id}@example.com`,
	});
}

function event(
	overrides: { id?: string; userId?: string; readAt?: Date | null } = {},
): Notification {
	const id = overrides.id ?? "notification-1";
	return Notification.create({
		id,
		userId: overrides.userId ?? USER_ID,
		type: "membership.accepted",
		payload: { membershipId: id, companyId: "company-1" },
		dedupeKey: `membership.accepted:${id}`,
		readAt: overrides.readAt ?? null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
	});
}

describe("MarkNotificationsReadUseCase", () => {
	it("marks all of the caller's unread notifications as read", async () => {
		const repository = new InMemoryNotificationRepository();
		repository.save(event({ id: "one" }));
		repository.save(event({ id: "two" }));
		const useCase = new MarkNotificationsReadUseCase({
			notificationRepository: repository,
		});

		await useCase.execute(buildUser());

		const result = await repository.findByUser(USER_ID);
		expect(result.every((item) => item.readAt !== null)).toBe(true);
	});

	it("never marks another user's notifications", async () => {
		const repository = new InMemoryNotificationRepository();
		repository.save(event({ id: "mine" }));
		repository.save(event({ id: "theirs", userId: "user-2" }));
		const useCase = new MarkNotificationsReadUseCase({
			notificationRepository: repository,
		});

		await useCase.execute(buildUser());

		const theirs = await repository.findByUser("user-2");
		expect(theirs[0]?.readAt).toBeNull();
	});

	it("is idempotent: a second run is a no-op", async () => {
		const repository = new InMemoryNotificationRepository();
		repository.save(event({ id: "one" }));
		const useCase = new MarkNotificationsReadUseCase({
			notificationRepository: repository,
		});

		await useCase.execute(buildUser());
		await useCase.execute(buildUser());

		const result = await repository.findByUser(USER_ID);
		expect(result).toHaveLength(1);
		expect(result[0]?.readAt).not.toBeNull();
	});
});
