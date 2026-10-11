import type {
	Membership,
	MembershipRole,
} from "../../domain/entities/membership.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { MembershipAlreadyExistsError } from "../../domain/errors/membership-already-exists-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";

export interface InviteMemberInput {
	/** The email of the user being invited. Must already be normalized (trimmed + lowercased). */
	email: string;
	/** The role the user will have once they accept the invitation. */
	role: MembershipRole;
}

export interface InviteMemberContext {
	/** The company to invite the user to. */
	companyId: string;
	/** The user ID of the inviter (the caller). */
	inviterId: string;
	/** The role of the inviter in the company. */
	inviterRole: MembershipRole;
}

export interface InviteMemberDependencies {
	membershipRepository: MembershipRepository;
}

/**
 * Use case for inviting a user to a company (MI-45).
 *
 * Creates an INVITED membership for the given email. The user will not have
 * access to the company until they accept the invitation (MI-46).
 *
 * Business rules enforced:
 * 1. The inviter must have permission to assign the target role (authorization.ts)
 * 2. The invited email must not already have an ACTIVE or INVITED membership
 *    in the company
 *
 * The caller is responsible for normalizing the email (trim + lowercase)
 * before passing it to this use case.
 */
export class InviteMemberUseCase {
	private readonly membershipRepository: MembershipRepository;

	constructor(dependencies: InviteMemberDependencies) {
		this.membershipRepository = dependencies.membershipRepository;
	}

	async execute(
		input: InviteMemberInput,
		context: InviteMemberContext,
	): Promise<Membership> {
		this.assertCanInvite(context.inviterRole, input.role);

		await this.assertNotAlreadyMember(input.email, context.companyId);

		return this.membershipRepository.invite({
			invitedEmail: input.email,
			companyId: context.companyId,
			role: input.role,
			invitedBy: context.inviterId,
		});
	}

	/**
	 * Asserts that the inviter has permission to assign the target role.
	 *
	 * Uses the authorization matrix (domain/policies/authorization.ts):
	 * - MEMBER: cannot assign anyone
	 * - ADMIN: can assign MEMBER or ADMIN
	 * - OWNER: can assign MEMBER, ADMIN, or OWNER
	 */
	private assertCanInvite(
		inviterRole: MembershipRole,
		targetRole: MembershipRole,
	): void {
		const action = this.actionForRole(targetRole);
		if (!can(inviterRole, action)) {
			throw new InsufficientRoleError();
		}
	}

	/**
	 * Maps a target role to the corresponding authorization action.
	 */
	private actionForRole(
		role: MembershipRole,
	): "assign_member" | "assign_admin" | "assign_owner" {
		switch (role) {
			case "MEMBER":
				return "assign_member";
			case "ADMIN":
				return "assign_admin";
			case "OWNER":
				return "assign_owner";
		}
	}

	/**
	 * Asserts that the email does not already have an ACTIVE or INVITED
	 * membership in the company.
	 */
	private async assertNotAlreadyMember(
		email: string,
		companyId: string,
	): Promise<void> {
		const existing = await this.membershipRepository.findByEmailAndCompany(
			email,
			companyId,
		);

		if (existing !== null && existing.status !== "REVOKED") {
			throw new MembershipAlreadyExistsError();
		}
	}
}
