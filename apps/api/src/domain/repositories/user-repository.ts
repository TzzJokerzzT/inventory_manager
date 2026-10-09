import type { User } from "../entities/user.js";

/**
 * The subset of an identity that becomes a persisted `users` row.
 *
 * It is deliberately not the application-layer `Identity`: the repository has
 * no concept of `emailVerified`, which is a gate decision made by the login
 * use case before this port is ever called.
 */
export interface UserIdentity {
	auth0Sub: string;
	email: string;
}

/**
 * Port for user persistence.
 *
 * This is an interface only: `application` and `domain` depend on this
 * abstraction, and `infrastructure` provides the concrete implementation.
 */
export interface UserRepository {
	/**
	 * Upserts by `auth0_sub`: logging in twice must update the existing row,
	 * never duplicate it nor fail on the unique constraint.
	 */
	upsertFromIdentity(identity: UserIdentity): Promise<User>;

	/** Lookup by `auth0_sub`, or `null` when no row exists. */
	findByAuth0Sub(auth0Sub: string): Promise<User | null>;

	/**
	 * Sets (or clears with `null`) the display name of the row identified by
	 * `userId`.
	 *
	 * Returns `null` when no such row exists instead of throwing: there is a
	 * real race between `requireUser` resolving the caller and this write (the
	 * row can be deleted in between), and a `Promise<User>` would surface that
	 * race as a 500 with a raw Prisma P2025. `null` lets the use case raise the
	 * same `user_not_provisioned` 403 the middleware already emits -- fail
	 * closed, no invented user.
	 */
	updateFullName(userId: string, fullName: string | null): Promise<User | null>;
}
