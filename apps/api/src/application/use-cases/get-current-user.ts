import type { Company } from "../../domain/entities/company.js";
import type { MembershipRole } from "../../domain/entities/membership.js";
import type { User } from "../../domain/entities/user.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";

/**
 * The explicit public view of the authenticated user.
 *
 * `auth0Sub` is deliberately absent: the Auth0 subject is the backend's
 * correlation key with the identity provider, not a user-facing field. The
 * view is built field by field on purpose -- `user.toJSON()` includes
 * `auth0Sub` and would leak it through `GET /me`.
 */
export interface CurrentUserView {
	id: string;
	email: string;
	fullName: string | null;
	createdAt: string;
}

export interface CurrentUserMembership {
	companyId: string;
	role: MembershipRole;
	/** The domain entity; it serializes through its own `toJSON`. */
	company: Company;
}

export interface GetCurrentUserResult {
	user: CurrentUserView;
	memberships: CurrentUserMembership[];
}

export interface GetCurrentUserDependencies {
	membershipRepository: MembershipRepository;
	companyRepository: CompanyRepository;
}

/**
 * Builds the payload behind `GET /me`: the caller's identity plus each active
 * membership with its company and role.
 *
 * It joins the memberships with the caller's companies in memory, so the whole
 * read is two queries and never N+1 (`findActiveByUser` + `findAllForUser`).
 * No company-scoped repository call happens inside the loop.
 */
export class GetCurrentUserUseCase {
	private readonly membershipRepository: MembershipRepository;
	private readonly companyRepository: CompanyRepository;

	constructor(dependencies: GetCurrentUserDependencies) {
		this.membershipRepository = dependencies.membershipRepository;
		this.companyRepository = dependencies.companyRepository;
	}

	async execute(user: User): Promise<GetCurrentUserResult> {
		const [memberships, companies] = await Promise.all([
			this.membershipRepository.findActiveByUser(user.id),
			this.companyRepository.findAllForUser(user.id),
		]);

		const companiesById = new Map(
			companies.map((company) => [company.id, company]),
		);

		return {
			user: {
				id: user.id,
				email: user.email,
				fullName: user.fullName,
				createdAt: user.createdAt.toISOString(),
			},
			memberships: memberships.flatMap((membership) => {
				const company = companiesById.get(membership.companyId);

				// Fail-closed: a membership without a matching company in the
				// user's own listing is dropped. An inconsistency between the two
				// queries must under-report -- never emit a company that the
				// caller's own listing did not authorize.
				if (company === undefined) {
					return [];
				}

				return [
					{
						companyId: membership.companyId,
						role: membership.role,
						company,
					},
				];
			}),
		};
	}
}
