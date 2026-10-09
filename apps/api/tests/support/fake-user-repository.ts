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
 *
 * `updateFullName` mutates the in-memory row so a later `findByAuth0Sub` sees
 * the new name, which is what `PATCH /me` followed by `GET /me` depends on. It
 * bridges through `User.create`, so the domain normalisation point is applied
 * here exactly as it is by the Prisma adapter.
 */
export function createFakeUserRepository(users: User[] = []): UserRepository {
	const rows = [...users];

	return {
		upsertFromIdentity: async (identity) => User.create(identity),
		findByAuth0Sub: async (auth0Sub) =>
			rows.find((user) => user.auth0Sub === auth0Sub) ?? null,
		updateFullName: async (userId, fullName) => {
			const index = rows.findIndex((user) => user.id === userId);
			if (index === -1) {
				return null;
			}

			const current = rows[index];
			const updated = User.create({
				id: current.id,
				auth0Sub: current.auth0Sub,
				email: current.email,
				createdAt: current.createdAt,
				fullName,
			});
			rows[index] = updated;

			return updated;
		},
	};
}
