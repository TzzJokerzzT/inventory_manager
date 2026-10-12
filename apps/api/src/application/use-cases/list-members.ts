import type {
	Membership,
	MembershipRole,
} from "../../domain/entities/membership.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";

export interface ListMembersContext {
	/** The company whose roster is being read. */
	companyId: string;
	/** The caller's role in that company. */
	actorRole: MembershipRole;
}

export interface ListMembersDependencies {
	membershipRepository: MembershipRepository;
}

/**
 * Use case for listing a company's membership roster (MI-47, EMP-09).
 *
 * The company scoping is already done by `requireCompanyContext` and by the
 * query itself (`findByCompany`), so the caller can only ever see the roster of
 * a company they belong to: "see the users of *your* companies" is enforced by
 * the filter, not by the role, which is why `view_users` allows every role.
 *
 * The `can` call is kept even though no role is currently denied: the matrix
 * stays the single place the rule lives, so denying a role later is a change in
 * one file instead of a hunt for the endpoints that forgot to ask.
 */
export class ListMembersUseCase {
	private readonly membershipRepository: MembershipRepository;

	constructor(dependencies: ListMembersDependencies) {
		this.membershipRepository = dependencies.membershipRepository;
	}

	async execute(context: ListMembersContext): Promise<Membership[]> {
		if (!can(context.actorRole, "view_users")) {
			throw new InsufficientRoleError();
		}

		return this.membershipRepository.findByCompany(context.companyId);
	}
}
