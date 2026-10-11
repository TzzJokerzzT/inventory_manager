import type { Membership } from "../../domain/entities/membership.js";
import type { User } from "../../domain/entities/user.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";

export interface AcceptInvitationsDependencies {
	membershipRepository: MembershipRepository;
}

/**
 * Use case for accepting the caller's pending invitations (MI-46).
 *
 * It claims every `INVITED` membership addressed to the caller's own email and
 * turns it into an `ACTIVE` one. The subject is the resolved `User`, never an
 * email from the request: `requireUser` is what makes it implicit, so a caller
 * cannot accept somebody else's invitation.
 *
 * It is deliberately idempotent and non-failing when there is nothing pending:
 * the web client calls it after every login/registration, and "you had no
 * invitations" is the normal case, not an error. An empty array is the
 * honest answer, so the client never has to special-case a 404.
 *
 * Each acceptance is guarded by the repository (only a still-`INVITED` row is
 * updated); a row that stopped being `INVITED` in between -- a revocation, or a
 * concurrent acceptance -- comes back `null` and is simply skipped rather than
 * reported as accepted.
 */
export class AcceptInvitationsUseCase {
	private readonly membershipRepository: MembershipRepository;

	constructor(dependencies: AcceptInvitationsDependencies) {
		this.membershipRepository = dependencies.membershipRepository;
	}

	async execute(user: User): Promise<Membership[]> {
		const pending = await this.membershipRepository.findInvitedByEmail(
			user.email,
		);

		const accepted: Membership[] = [];
		for (const membership of pending) {
			const result = await this.membershipRepository.accept({
				membershipId: membership.id,
				userId: user.id,
			});

			if (result !== null) {
				accepted.push(result);
			}
		}

		return accepted;
	}
}
