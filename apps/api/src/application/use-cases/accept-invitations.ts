import type { Membership } from "../../domain/entities/membership.js";
import { MEMBERSHIP_ACCEPTED_NOTIFICATION_TYPE } from "../../domain/entities/notification.js";
import type { User } from "../../domain/entities/user.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";
import type { NotificationRepository } from "../../domain/repositories/notification-repository.js";

export interface AcceptInvitationsDependencies {
	membershipRepository: MembershipRepository;
	notificationRepository: NotificationRepository;
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
 *
 * Acceptance also records an event for the inviter ("your invitation was
 * accepted"). That write is a *second* statement after the membership write,
 * deliberately not atomic with it: making the membership invariant depend on
 * the notification schema would couple two bounded contexts, and the accepted
 * state is true either way. The declared window is that a process death
 * between the two writes loses the notification while the membership stays
 * `ACTIVE`; the inviter still sees the truth in the roster. The notification
 * write is idempotent on `dedupeKey`, so the retry the client already does
 * cannot double-record it.
 */
export class AcceptInvitationsUseCase {
	private readonly membershipRepository: MembershipRepository;
	private readonly notificationRepository: NotificationRepository;

	constructor(dependencies: AcceptInvitationsDependencies) {
		this.membershipRepository = dependencies.membershipRepository;
		this.notificationRepository = dependencies.notificationRepository;
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
				await this.notifyInviter(result, user.id);
			}
		}

		return accepted;
	}

	/**
	 * Records the accepted-invitation event for the inviter.
	 *
	 * The acceptance already happened, so a failed notification write must not
	 * fail the request or roll the membership back. It is a real failure,
	 * though, so it is reported through the same channel the infrastructure
	 * adapters use (`console.error`) rather than swallowed: losing the event is
	 * acceptable, hiding it is not.
	 *
	 * The audience is `membership.invitedBy`, which the acceptance already
	 * resolved -- no extra lookup is needed to know who to notify. The payload
	 * carries the ids the reader needs (`membershipId`, `companyId`) plus the
	 * accepting user as `actorId`, so the read never has to guess the company or
	 * who to name: the caller *is* the actor, so the accept already knows it.
	 */
	private async notifyInviter(
		membership: Membership,
		actorId: string,
	): Promise<void> {
		try {
			await this.notificationRepository.create({
				userId: membership.invitedBy,
				type: MEMBERSHIP_ACCEPTED_NOTIFICATION_TYPE,
				payload: {
					membershipId: membership.id,
					companyId: membership.companyId,
					actorId,
				},
				// Deterministic from the event: a retried accept or a double
				// click resolves to the same key and is a no-op.
				dedupeKey: `${MEMBERSHIP_ACCEPTED_NOTIFICATION_TYPE}:${membership.id}`,
			});
		} catch (error) {
			console.error(
				`Failed to record the membership-accepted notification for membership ${membership.id}:`,
				error,
			);
		}
	}
}
