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
}
