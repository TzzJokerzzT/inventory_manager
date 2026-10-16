import type { Company } from "../../domain/entities/company.js";
import type { MembershipRole } from "../../domain/entities/membership.js";
import type { User } from "../../domain/entities/user.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";

/**
 * A user as another member sees them: the inviter of a pending invitation or
 * the actor of a notification event.
 *
 * One shape for both: the two were structurally identical, and two types that
 * must stay identical drift the moment one of them grows a field. `fullName`
 * is nullable because a user provisioned by Auth0 starts without a name; the
 * email is then the identifier the UI falls back to. The shape is deliberately
 * minimal -- no roles, no memberships -- to keep it context, not a second user
 * profile.
 */
export interface UserSummary {
	id: string;
	fullName: string | null;
	email: string;
}

/**
 * One pending invitation as the caller sees it.
 *
 * `status` is deliberately absent: the read already pins it to `INVITED`, so
 * repeating it would be dead weight. `company` is the domain entity and
 * serializes through its own `toJSON`; without it the list could only say "you
 * have an invitation" and not to what. `membershipId` is exposed so the client
 * has a stable key for the row.
 *
 * `inviter` is `null` when the inviter's user row could not be resolved. A
 * missing inviter never hides the invitation: the invitation is the fact, the
 * inviter is context.
 */
export interface PendingInvitation {
	membershipId: string;
	companyId: string;
	role: MembershipRole;
	/** When the invitation was created, i.e. the membership's `createdAt`. */
	invitedAt: string;
	company: Company;
	inviter: UserSummary | null;
}

export interface ListPendingInvitationsDependencies {
	membershipRepository: MembershipRepository;
	companyRepository: CompanyRepository;
	userRepository: UserRepository;
}

/**
 * Builds the payload behind `GET /me/invitations`: the caller's pending
 * (`INVITED`) memberships with the company that invited them and who invited
 * them.
 *
 * The subject is the resolved `User`, never an email from the request, so a
 * caller can only ever see invitations addressed to their own account. The
 * criterion is exactly `AcceptInvitationsUseCase`'s
 * (`findInvitedByEmail(user.email)`): there must not be two definitions of
 * "pending invitation".
 *
 * The companies and the inviters are resolved with a single `findByIds` call
 * each after the membership read, so the whole read is three queries and never
 * N+1. Several invitations can come from the same person, so the inviter ids
 * are deduplicated before the batch read. A membership whose company the batch
 * read did not return is dropped fail-closed, like `GET /me`: under-reporting
 * is safe, emitting a company the read did not return is not. A membership
 * whose inviter the batch read did not return keeps its invitation and answers
 * `inviter: null` instead.
 */
export class ListPendingInvitationsUseCase {
	private readonly membershipRepository: MembershipRepository;
	private readonly companyRepository: CompanyRepository;
	private readonly userRepository: UserRepository;

	constructor(dependencies: ListPendingInvitationsDependencies) {
		this.membershipRepository = dependencies.membershipRepository;
		this.companyRepository = dependencies.companyRepository;
		this.userRepository = dependencies.userRepository;
	}

	async execute(user: User): Promise<PendingInvitation[]> {
		const memberships = await this.membershipRepository.findInvitedByEmail(
			user.email,
		);

		if (memberships.length === 0) {
			return [];
		}

		const companies = await this.companyRepository.findByIds(
			memberships.map((membership) => membership.companyId),
		);
		const companiesById = new Map(
			companies.map((company) => [company.id, company]),
		);

		// Deduplicate before the batch read: several invitations from the same
		// person must cost one lookup, not one per invitation.
		const inviterIds = [
			...new Set(memberships.map((membership) => membership.invitedBy)),
		];
		const inviters = await this.userRepository.findByIds(inviterIds);
		const invitersById = new Map(
			inviters.map((inviter) => [inviter.id, inviter]),
		);

		return memberships.flatMap((membership) => {
			const company = companiesById.get(membership.companyId);

			if (company === undefined) {
				return [];
			}

			const inviter = invitersById.get(membership.invitedBy);

			return [
				{
					membershipId: membership.id,
					companyId: membership.companyId,
					role: membership.role,
					invitedAt: membership.createdAt.toISOString(),
					company,
					inviter: inviter
						? {
								id: inviter.id,
								fullName: inviter.fullName,
								email: inviter.email,
							}
						: null,
				},
			];
		});
	}
}
