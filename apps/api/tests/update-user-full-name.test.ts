import { UpdateUserFullNameUseCase } from "../src/application/use-cases/update-user-full-name.js";
import { User } from "../src/domain/entities/user.js";
import { UserNotProvisionedError } from "../src/domain/errors/user-not-provisioned-error.js";
import { createFakeUserRepository } from "./support/fake-user-repository.js";

const USER_ID = "user-1";
const USER_SUB = "auth0|user-1";
const USER_EMAIL = "user@example.com";
const USER_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

function buildUser(fullName: string | null = null, id = USER_ID): User {
	return User.create({
		id,
		auth0Sub: id === USER_ID ? USER_SUB : `auth0|${id}`,
		email: id === USER_ID ? USER_EMAIL : `${id}@example.com`,
		createdAt: USER_CREATED_AT,
		fullName,
	});
}

function buildUseCase(users: User[]) {
	return new UpdateUserFullNameUseCase({
		userRepository: createFakeUserRepository(users),
	});
}

describe("UpdateUserFullNameUseCase", () => {
	it("sets a full name and returns the entity carrying the new value", async () => {
		const stale = buildUser(null);
		const useCase = buildUseCase([stale]);

		const updated = await useCase.execute(stale, "Alexis Buelvas");

		// The caller's entity was resolved before the write, so it must not be
		// the object returned: the controller builds the `200` from this one.
		expect(updated).not.toBe(stale);
		expect(stale.fullName).toBeNull();
		expect(updated.fullName).toBe("Alexis Buelvas");
		expect(updated.id).toBe(USER_ID);
	});

	it("trims the surrounding whitespace before persisting", async () => {
		const stale = buildUser(null);
		const useCase = buildUseCase([stale]);

		const updated = await useCase.execute(stale, "  Alexis Buelvas  ");

		expect(updated.fullName).toBe("Alexis Buelvas");
	});

	it("clears the full name when given null", async () => {
		const stale = buildUser("Alexis Buelvas");
		const useCase = buildUseCase([stale]);

		const updated = await useCase.execute(stale, null);

		expect(updated.fullName).toBeNull();
	});

	it("collapses an empty or whitespace-only value to null", async () => {
		const stale = buildUser("Alexis Buelvas");
		const useCase = buildUseCase([stale]);

		await expect(useCase.execute(stale, "")).resolves.toMatchObject({
			fullName: null,
		});
		await expect(useCase.execute(stale, "   ")).resolves.toMatchObject({
			fullName: null,
		});
	});

	it("only touches the caller's row", async () => {
		const caller = buildUser(null, "user-1");
		const other = buildUser("Someone Else", "user-2");
		const userRepository = createFakeUserRepository([caller, other]);
		const useCase = new UpdateUserFullNameUseCase({ userRepository });

		const updated = await useCase.execute(caller, "Alexis Buelvas");

		expect(updated.fullName).toBe("Alexis Buelvas");
		// The write is keyed on the caller's id, so the other row keeps its own
		// name while the caller's row carries the new one.
		expect(
			(await userRepository.findByAuth0Sub("auth0|user-2"))?.fullName,
		).toBe("Someone Else");
		expect(
			(await userRepository.findByAuth0Sub("auth0|user-1"))?.fullName,
		).toBe("Alexis Buelvas");
	});

	it("throws UserNotProvisionedError when the row is gone", async () => {
		const stale = buildUser(null);
		// The row disappears between `requireUser` and the write; the port
		// answers `null` and the use case must fail closed with a 403-mapped
		// error instead of a fabricated user or a raw Prisma 500.
		const useCase = buildUseCase([]);

		await expect(
			useCase.execute(stale, "Alexis Buelvas"),
		).rejects.toBeInstanceOf(UserNotProvisionedError);
	});
});
