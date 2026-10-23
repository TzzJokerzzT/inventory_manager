import type { SessionRepository } from "../../domain/repositories/session-repository.js";

export interface EndSessionInput {
	sessionId: string;
}

export interface EndSessionDependencies {
	sessionRepository: SessionRepository;
	clock?: () => Date;
}

/**
 * Invalidates the session a logout belongs to.
 *
 * This is what turns logout from "the browser forgot the cookie" into "the
 * credential no longer works": once the row is tombstoned, replaying the same
 * cookies against `/auth/refresh` answers 401. It never throws for a missing or
 * already revoked session — logout is idempotent, and answering an error for a
 * repeated sign-out would only make the client retry.
 */
export class EndSessionUseCase {
	private readonly sessionRepository: SessionRepository;
	private readonly clock: () => Date;

	constructor(dependencies: EndSessionDependencies) {
		this.sessionRepository = dependencies.sessionRepository;
		this.clock = dependencies.clock ?? (() => new Date());
	}

	async execute(input: EndSessionInput): Promise<void> {
		const session = await this.sessionRepository.findById(input.sessionId);

		if (session === null || session.isRevoked()) {
			return;
		}

		await this.sessionRepository.revoke(input.sessionId, this.clock());
	}
}
