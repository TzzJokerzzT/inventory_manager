import { SessionInvalidError } from "../../domain/errors/session-invalid-error.js";
import type { SessionRepository } from "../../domain/repositories/session-repository.js";

export interface ResumeSessionInput {
	sessionId: string;
}

export interface ResumeSessionDependencies {
	sessionRepository: SessionRepository;
	/**
	 * How long a session may go without activity before it stops being
	 * exchangeable. It is injected (not read from the environment here) so the
	 * domain rule is testable with seconds and production can use days.
	 */
	idleTimeoutMs: number;
	clock?: () => Date;
}

/**
 * Decides whether a session may be used again, and records the use.
 *
 * This is the single gate of the credential window: unknown, revoked and
 * idle-expired all collapse into {@link SessionInvalidError}, because the
 * caller must not learn which one it was.
 *
 * It is called **before** the refresh token is handed to the identity
 * provider. That order is load-bearing: with rotation enabled, exchanging a
 * token produces a new one and invalidates the old, so exchanging first and
 * rejecting afterwards would destroy a working session just to answer 401.
 */
export class ResumeSessionUseCase {
	private readonly sessionRepository: SessionRepository;
	private readonly idleTimeoutMs: number;
	private readonly clock: () => Date;

	constructor(dependencies: ResumeSessionDependencies) {
		this.sessionRepository = dependencies.sessionRepository;
		this.idleTimeoutMs = dependencies.idleTimeoutMs;
		this.clock = dependencies.clock ?? (() => new Date());
	}

	async execute(input: ResumeSessionInput): Promise<void> {
		const now = this.clock();
		const session = await this.sessionRepository.findById(input.sessionId);

		if (session === null || session.isExpiredAt(now, this.idleTimeoutMs)) {
			throw new SessionInvalidError();
		}

		// Activity is this successful resume: a person who keeps using the app
		// renews the token long before the window closes, so the clock is
		// always moved by the same event that proves the session is alive.
		await this.sessionRepository.touch(input.sessionId, now);
	}
}
