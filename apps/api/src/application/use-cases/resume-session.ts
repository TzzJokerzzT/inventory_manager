import { SessionInvalidError } from "../../domain/errors/session-invalid-error.js";
import type { SessionRepository } from "../../domain/repositories/session-repository.js";
import { hashRefreshToken } from "../session-token-hash.js";

export interface ResumeSessionInput {
	sessionId: string;
	/** The token presented in the cookie; only its digest is compared. */
	refreshToken: string;
}

export interface RecordRefreshInput {
	sessionId: string;
	/**
	 * The token in force after the exchange: the provider's new one when it
	 * rotated, otherwise the one that was presented.
	 */
	refreshToken: string;
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
		const session = await this.sessionRepository.findById(input.sessionId);

		if (session === null) {
			throw new SessionInvalidError();
		}

		// Both halves of the pair have to agree: a live row alone is not enough,
		// because that would let a stolen refresh token be exchanged next to any
		// other live session. The digest comparison is what makes logout and the
		// idle window cover the credential instead of just one browser.
		if (
			session.isExpiredAt(this.clock(), this.idleTimeoutMs) ||
			!session.matchesRefreshTokenHash(hashRefreshToken(input.refreshToken))
		) {
			throw new SessionInvalidError();
		}
	}

	/**
	 * Records the refresh **after** the provider accepted it.
	 *
	 * Order matters in both directions: moving the clock before the exchange
	 * would let a rejected or failing provider keep the session alive forever,
	 * and storing the rotated digest before it would lock out a browser whose
	 * exchange never completed.
	 */
	async recordRefresh(input: RecordRefreshInput): Promise<void> {
		await this.sessionRepository.recordRefresh(
			input.sessionId,
			hashRefreshToken(input.refreshToken),
			this.clock(),
		);
	}
}
