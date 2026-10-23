import { DomainError } from "../errors/domain-error.js";

export interface SessionProps {
	id: string;
	userId: string;
	createdAt: Date;
	lastActivityAt: Date;
	revokedAt: Date | null;
}

export interface CreateSessionProps {
	id?: string;
	userId: string;
	createdAt?: Date;
	lastActivityAt?: Date;
	revokedAt?: Date | null;
}

/**
 * A server-side session: the row that lets the API decide whether a refresh
 * cookie may still be exchanged for tokens.
 *
 * It exists because a cookie cannot be un-issued. The refresh token is opaque
 * and stays valid at the identity provider until its own expiry, so the only
 * place where "this person has been idle too long" or "this browser signed
 * out" can be enforced is a record the server owns. That record is this
 * entity.
 *
 * Two timestamps carry the whole policy: `lastActivityAt` moves forward on
 * every successful refresh, and `revokedAt` is a tombstone set by logout. The
 * idle window itself is not baked in here — {@link Session.isExpiredAt}
 * receives it, so the same row can be judged by a test with a 3-second window
 * and by production with a 5-day one.
 */
export class Session {
	private constructor(private readonly props: SessionProps) {}

	static create(input: CreateSessionProps): Session {
		const userId = input.userId.trim();
		if (userId.length === 0) {
			throw new DomainError("Session user id must not be empty");
		}

		const createdAt = input.createdAt ?? new Date();

		return new Session({
			id: input.id ?? globalThis.crypto.randomUUID(),
			userId,
			createdAt,
			// A brand new session was just used: its last activity is its
			// creation, never an epoch date that would make it born expired.
			lastActivityAt: input.lastActivityAt ?? createdAt,
			revokedAt: input.revokedAt ?? null,
		});
	}

	get id(): string {
		return this.props.id;
	}

	get userId(): string {
		return this.props.userId;
	}

	get createdAt(): Date {
		return this.props.createdAt;
	}

	get lastActivityAt(): Date {
		return this.props.lastActivityAt;
	}

	get revokedAt(): Date | null {
		return this.props.revokedAt;
	}

	isRevoked(): boolean {
		return this.props.revokedAt !== null;
	}

	/**
	 * Whether the session may no longer be used at `now`.
	 *
	 * A revoked session is expired by definition, and the comparison is `>=`:
	 * a session idle for exactly the whole window is already out. Being
	 * inclusive here is the fail-closed side of the boundary.
	 */
	isExpiredAt(now: Date, idleTimeoutMs: number): boolean {
		if (this.isRevoked()) {
			return true;
		}

		return now.getTime() - this.props.lastActivityAt.getTime() >= idleTimeoutMs;
	}

	touch(now: Date): Session {
		return new Session({ ...this.props, lastActivityAt: now });
	}

	/**
	 * Tombstones the session. Revoking twice keeps the first timestamp: the
	 * moment the credential became unusable is the one that matters, and a
	 * retried logout must not rewrite history.
	 */
	revoke(now: Date): Session {
		return new Session({
			...this.props,
			revokedAt: this.props.revokedAt ?? now,
		});
	}

	toJSON(): {
		id: string;
		userId: string;
		createdAt: string;
		lastActivityAt: string;
		revokedAt: string | null;
	} {
		return {
			id: this.id,
			userId: this.userId,
			createdAt: this.createdAt.toISOString(),
			lastActivityAt: this.lastActivityAt.toISOString(),
			revokedAt: this.revokedAt?.toISOString() ?? null,
		};
	}
}
