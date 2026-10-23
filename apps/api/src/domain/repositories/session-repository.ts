import type { Session } from "../entities/session.js";

/**
 * Port for session persistence.
 *
 * The port exposes `touch` and `revoke` as narrow writes instead of a generic
 * `save` on purpose: those are the only two mutations the policy ever needs,
 * and a whole-row write would let a caller silently move `createdAt` or clear
 * `revokedAt` — the two fields that define the credential's lifetime.
 */
export interface SessionRepository {
	/** Persists a new session; the entity already carries its own id and dates. */
	create(session: Session): Promise<Session>;

	/** Lookup by session id, or `null` when the row does not exist. */
	findById(sessionId: string): Promise<Session | null>;

	/**
	 * Moves `last_activity_at` forward. A no-op when the row is gone: the
	 * caller has already read it, and losing the race must not turn a refresh
	 * into a 500.
	 */
	touch(sessionId: string, lastActivityAt: Date): Promise<void>;

	/**
	 * Tombstones the session. Also a no-op when the row is gone or already
	 * revoked, which is what makes logout idempotent.
	 */
	revoke(sessionId: string, revokedAt: Date): Promise<void>;
}
