import { ListNotificationsUseCase } from "../src/application/use-cases/list-notifications.js";
import { Company } from "../src/domain/entities/company.js";
import { Notification } from "../src/domain/entities/notification.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryNotificationRepository } from "../src/infrastructure/database/in-memory-notification-repository.js";

const USER_ID = "user-1";
const USER_EMAIL = "inviter@example.com";
const OWNER_ID = "owner-1";
const OWNER_EMAIL = "owner@example.com";

function buildUser(): User {
	return User.create({
		id: USER_ID,
		auth0Sub: "auth0|user-1",
		email: USER_EMAIL,
	});
}

async function createCompany(
	repository: InMemoryCompanyRepository,
	id: string,
	name: string,
): Promise<Company> {
	return repository.createOwnedBy(
		Company.create({
			id,
			name,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		}),
		{ userId: OWNER_ID, email: OWNER_EMAIL },
	);
}

function event(
	overrides: {
		id?: string;
		userId?: string;
		payload?: Record<string, unknown>;
		readAt?: Date | null;
		createdAt?: Date;
	} = {},
): Notification {
	const id = overrides.id ?? "notification-1";
	return Notification.create({
		id,
		userId: overrides.userId ?? USER_ID,
		type: "membership.accepted",
		payload: overrides.payload ?? {
			membershipId: "membership-1",
			companyId: "company-a",
		},
		dedupeKey: `membership.accepted:${id}`,
		readAt: overrides.readAt ?? null,
		createdAt: overrides.createdAt ?? new Date("2026-01-02T00:00:00.000Z"),
	});
}

function buildUseCase() {
	const companyRepository = new InMemoryCompanyRepository();
	const notificationRepository = new InMemoryNotificationRepository();
	const useCase = new ListNotificationsUseCase({
		companyRepository,
		notificationRepository,
	});

	return { useCase, companyRepository, notificationRepository };
}

describe("ListNotificationsUseCase", () => {
	it("returns an empty list when the user has no notifications", async () => {
		const { useCase } = buildUseCase();

		await expect(useCase.execute(buildUser())).resolves.toEqual([]);
	});

	it("returns the caller's notifications newest first with their company", async () => {
		const { useCase, companyRepository, notificationRepository } =
			buildUseCase();
		const acme = await createCompany(companyRepository, "company-a", "Acme");
		notificationRepository.save(
			event({
				id: "older",
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			}),
		);
		notificationRepository.save(
			event({
				id: "newer",
				createdAt: new Date("2026-02-01T00:00:00.000Z"),
			}),
		);

		const result = await useCase.execute(buildUser());

		expect(result.map((item) => item.id)).toEqual(["newer", "older"]);
		expect(result[0]).toEqual({
			id: "newer",
			type: "membership.accepted",
			createdAt: "2026-02-01T00:00:00.000Z",
			readAt: null,
			company: acme,
		});
	});

	it("exposes readAt as an ISO string when the event was read", async () => {
		const { useCase, companyRepository, notificationRepository } =
			buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		const readAt = new Date("2026-03-01T00:00:00.000Z");
		notificationRepository.save(event({ readAt }));

		const [result] = await useCase.execute(buildUser());

		expect(result?.readAt).toBe(readAt.toISOString());
	});

	it("resolves the companies in a single batch read, deduplicated", async () => {
		const { useCase, companyRepository, notificationRepository } =
			buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		await createCompany(companyRepository, "company-b", "Globex");
		notificationRepository.save(
			event({ id: "one", payload: { companyId: "company-a" } }),
		);
		notificationRepository.save(
			event({ id: "two", payload: { companyId: "company-b" } }),
		);
		notificationRepository.save(
			event({ id: "three", payload: { companyId: "company-a" } }),
		);
		const findByIds = jest.spyOn(companyRepository, "findByIds");

		await useCase.execute(buildUser());

		expect(findByIds).toHaveBeenCalledTimes(1);
		// Order is not part of the contract; dedup is.
		expect([...findByIds.mock.calls[0][0]].sort()).toEqual([
			"company-a",
			"company-b",
		]);
	});

	it("answers company null without hiding the event when the company does not resolve", async () => {
		const { useCase, notificationRepository } = buildUseCase();
		notificationRepository.save(
			event({ payload: { companyId: "company-ghost" } }),
		);

		const [result] = await useCase.execute(buildUser());

		expect(result?.company).toBeNull();
		expect(result?.type).toBe("membership.accepted");
	});

	it("answers company null when the payload carries no usable company id", async () => {
		const { useCase, notificationRepository } = buildUseCase();
		notificationRepository.save(event({ payload: { membershipId: "m-1" } }));

		const [result] = await useCase.execute(buildUser());

		expect(result?.company).toBeNull();
	});

	it("never returns another user's notifications", async () => {
		const { useCase, companyRepository, notificationRepository } =
			buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		notificationRepository.save(event({ id: "mine", userId: USER_ID }));
		notificationRepository.save(event({ id: "theirs", userId: "user-2" }));

		const result = await useCase.execute(buildUser());

		expect(result.map((item) => item.id)).toEqual(["mine"]);
	});
});
