import type { Session } from "../../domain/entities/session.js";
import type { SessionRepository } from "../../domain/repositories/session-repository.js";

/**
 * In-memory adapter for the {@link SessionRepository} port.
 *
 * It exists so the HTTP tests can drive login, refresh and logout without a
 * database. It applies the same rules as the Prisma adapter — `touch` and
 * `revoke` are no-ops for a missing row, a second revoke keeps the first
 * timestamp — so the two stay interchangeable behind the port.
 */
export class InMemorySessionRepository implements SessionRepository {
	private readonly sessions = new Map<string, Session>();

	constructor(sessions: Session[] = []) {
		for (const session of sessions) {
			this.sessions.set(session.id, session);
		}
	}

	async create(session: Session): Promise<Session> {
		this.sessions.set(session.id, session);
		return session;
	}

	async findById(sessionId: string): Promise<Session | null> {
		return this.sessions.get(sessionId) ?? null;
	}

	async recordRefresh(
		sessionId: string,
		refreshTokenHash: string,
		lastActivityAt: Date,
	): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (session === undefined) {
			return;
		}

		this.sessions.set(
			sessionId,
			session.recordRefresh(refreshTokenHash, lastActivityAt),
		);
	}

	async revoke(sessionId: string, revokedAt: Date): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (session === undefined) {
			return;
		}

		this.sessions.set(sessionId, session.revoke(revokedAt));
	}
}
