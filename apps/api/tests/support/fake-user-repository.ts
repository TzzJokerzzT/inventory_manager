import { User } from "../../src/domain/entities/user.js";
import type { UserRepository } from "../../src/domain/repositories/user-repository.js";

/**
 * The `sub` the local JWKS issuer stamps into tokens by default. Keeping it in
 * one place means the fakes and the tests stay consistent with the issuer.
 */
export const TEST_SUB = "auth0|test-user";

/**
 * A hand-written `UserRepository` double for the HTTP tests. It resolves a
 * fixed set of users by `auth0_sub` and is otherwise a no-op, so the company
 * slices can run behind `requireUser` without a database.
 */
export function createFakeUserRepository(users: User[] = []): UserRepository {
	return {
		upsertFromIdentity: async (identity) => User.create(identity),
		findByAuth0Sub: async (auth0Sub) =>
			users.find((user) => user.auth0Sub === auth0Sub) ?? null,
	};
}
