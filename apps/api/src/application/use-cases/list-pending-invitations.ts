import type { Company } from "../../domain/entities/company.js";
import type { MembershipRole } from "../../domain/entities/membership.js";
import type { User } from "../../domain/entities/user.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";

/**
 * One pending invitation as the caller sees it.
 *
 * `status` is deliberately absent: the read already pins it to `INVITED`, so
 * repeating it would be dead weight. `company` is the domain entity and
 * serializes through its own `toJSON`; without it the list could only say "you
 * have an invitation" and not to what. `membershipId` is exposed so the client
 * has a stable key for the row.
 */
export interface PendingInvitation {
	membershipId: string;
	companyId: string;
	role: MembershipRole;
	/** When the invitation was created, i.e. the membership's `createdAt`. */
	invitedAt: string;
	company: Company;
}

export interface ListPendingInvitationsDependencies {
	membershipRepository: MembershipRepository;
	companyRepository: CompanyRepository;
}

/**
 * Builds the payload behind `GET /me/invitations`: the caller's pending
 * (`INVITED`) memberships with the company that invited them.
 *
 * The subject is the resolved `User`, never an email from the request, so a
 * caller can only ever see invitations addressed to their own account. The
 * criterion is exactly `AcceptInvitationsUseCase`'s
 * (`findInvitedByEmail(user.email)`): there must not be two definitions of
 * "pending invitation".
 *
 * The companies are resolved with a single `findByIds` call after the
 * membership read, so the whole read is two queries and never N+1. A
 * membership whose company the batch read did not return is dropped
 * fail-closed, like `GET /me`: under-reporting is safe, emitting a company the
 * read did not return is not.
 */
export class ListPendingInvitationsUseCase {
	private readonly membershipRepository: MembershipRepository;
	private readonly companyRepository: CompanyRepository;

	constructor(dependencies: ListPendingInvitationsDependencies) {
		this.membershipRepository = dependencies.membershipRepository;
		this.companyRepository = dependencies.companyRepository;
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

		return memberships.flatMap((membership) => {
			const company = companiesById.get(membership.companyId);

			if (company === undefined) {
				return [];
			}

			return [
				{
					membershipId: membership.id,
					companyId: membership.companyId,
					role: membership.role,
					invitedAt: membership.createdAt.toISOString(),
					company,
				},
			];
		});
	}
}
