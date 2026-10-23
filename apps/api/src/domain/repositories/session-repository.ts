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
	 * Records a refresh that actually happened: `last_activity_at` moves forward
	 * **and** the token digest is replaced, because a rotating provider issues a
	 * new token the row must now expect.
	 *
	 * It is deliberately one write: a refresh that moved the clock but kept the
	 * old digest would lock the browser out on the next round trip, and one that
	 * rotated the digest without moving the clock would stop counting activity.
	 * A no-op when the row is gone: the caller already read it, and losing the
	 * race must not turn a refresh into a 500.
	 */
	recordRefresh(
		sessionId: string,
		refreshTokenHash: string,
		lastActivityAt: Date,
	): Promise<void>;

	/**
	 * Tombstones the session. Also a no-op when the row is gone or already
	 * revoked, which is what makes logout idempotent.
	 */
	revoke(sessionId: string, revokedAt: Date): Promise<void>;
}
