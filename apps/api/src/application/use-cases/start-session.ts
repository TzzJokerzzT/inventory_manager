import { Session } from "../../domain/entities/session.js";
import type { SessionRepository } from "../../domain/repositories/session-repository.js";
import { hashRefreshToken } from "../session-token-hash.js";

export interface StartSessionInput {
	userId: string;
	/**
	 * The refresh token the login just received. Only its digest is persisted:
	 * it is what ties the row to the credential and makes the pair inseparable.
	 */
	refreshToken: string;
}

export interface StartSessionDependencies {
	sessionRepository: SessionRepository;
	/** Injected so a test can pin "now" instead of sleeping. */
	clock?: () => Date;
}

/**
 * Creates the server-side session a successful login is bound to.
 *
 * It runs after the credentials were accepted and the `users` row exists,
 * because the session points at that row. It deliberately does not talk to the
 * identity provider: the tokens are already in hand, and this use case only
 * owns the record that will later decide whether they may be renewed.
 */
export class StartSessionUseCase {
	private readonly sessionRepository: SessionRepository;
	private readonly clock: () => Date;

	constructor(dependencies: StartSessionDependencies) {
		this.sessionRepository = dependencies.sessionRepository;
		this.clock = dependencies.clock ?? (() => new Date());
	}

	async execute(input: StartSessionInput): Promise<Session> {
		return this.sessionRepository.create(
			Session.create({
				userId: input.userId,
				createdAt: this.clock(),
				refreshTokenHash: hashRefreshToken(input.refreshToken),
			}),
		);
	}
}
