import { User } from "../../domain/entities/user.js";
import type {
	UserIdentity,
	UserRepository,
} from "../../domain/repositories/user-repository.js";
import type { PrismaClient } from "./generated/prisma/client.js";

/**
 * The adapter depends only on the Prisma `user` delegate, not on the whole
 * client, so the injected surface stays as small as the port needs. The
 * import is type-only on purpose: the generated client is ESM-first and Jest
 * runs through `@swc/jest` in CommonJS, so a runtime import would break the
 * test suite.
 */
type UserDelegate = Pick<PrismaClient, "user">;

/**
 * Prisma's "record to update not found" code. It is matched structurally
 * instead of by importing `PrismaClientKnownRequestError`: that import would
 * pull the ESM-first generated runtime into Jest's CommonJS transform and
 * break the suite (the same reason this file imports the client type-only).
 */
const PRISMA_RECORD_NOT_FOUND = "P2025";

function isRecordNotFound(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === PRISMA_RECORD_NOT_FOUND
	);
}

export interface PrismaUserRepositoryDependencies {
	prisma: UserDelegate;
}

/**
 * Prisma-backed adapter for the {@link UserRepository} port.
 *
 * Rows are always mapped back to the domain entity; a raw Prisma object never
 * crosses the port boundary. The upsert is keyed by `auth0_sub`, so a second
 * login updates the existing row instead of failing on the unique constraint.
 * The create path writes the id the domain entity already generated, so the
 * database default (`gen_random_uuid()`) is never allowed to silently replace
 * it.
 */
export class PrismaUserRepository implements UserRepository {
	private readonly prisma: UserDelegate;

	constructor(dependencies: PrismaUserRepositoryDependencies) {
		this.prisma = dependencies.prisma;
	}

	async upsertFromIdentity(identity: UserIdentity): Promise<User> {
		// `User.create` lowercases the email and generates id/createdAt before
		// anything is persisted, so the database CHECK is satisfied by
		// construction.
		const user = User.create(identity);

		const row = await this.prisma.user.upsert({
			where: { auth0Sub: user.auth0Sub },
			create: {
				id: user.id,
				auth0Sub: user.auth0Sub,
				email: user.email,
				fullName: user.fullName,
				createdAt: user.createdAt,
			},
			// On a second login only the email is refreshed; the id and the
			// creation timestamp of the original row stay untouched. `fullName`
			// is deliberately absent here: a second login must never overwrite a
			// name the user set by hand.
			update: { email: user.email },
		});

		return User.create({
			id: row.id,
			auth0Sub: row.auth0Sub,
			email: row.email,
			fullName: row.fullName,
			createdAt: row.createdAt,
		});
	}

	async findByAuth0Sub(auth0Sub: string): Promise<User | null> {
		const row = await this.prisma.user.findUnique({
			where: { auth0Sub },
		});

		if (row === null) {
			return null;
		}

		return User.create({
			id: row.id,
			auth0Sub: row.auth0Sub,
			email: row.email,
			fullName: row.fullName,
			createdAt: row.createdAt,
		});
	}

	async updateFullName(
		userId: string,
		fullName: string | null,
	): Promise<User | null> {
		// Normalise before persisting so `""`, `"   "` and `null` all land as
		// SQL NULL; the real row stays the single source of truth of the name.
		const normalized = User.normalizeFullName(fullName);

		try {
			const row = await this.prisma.user.update({
				where: { id: userId },
				data: { fullName: normalized },
			});

			return User.create({
				id: row.id,
				auth0Sub: row.auth0Sub,
				email: row.email,
				fullName: row.fullName,
				createdAt: row.createdAt,
			});
		} catch (error) {
			// A missing row is a legitimate race outcome, not a failure: the
			// port answers `null` so the caller can fail closed with a 403
			// instead of leaking a raw Prisma error as a 500.
			if (isRecordNotFound(error)) {
				return null;
			}

			throw error;
		}
	}
}
