import type {
	Membership,
	MembershipRole,
} from "../../domain/entities/membership.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { LastActiveOwnerError } from "../../domain/errors/last-active-owner-error.js";
import { MembershipNotFoundError } from "../../domain/errors/membership-not-found-error.js";
import {
	assignmentActionForRole,
	can,
} from "../../domain/policies/authorization.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";

export interface ChangeMemberRoleInput {
	membershipId: string;
	role: MembershipRole;
}

export interface ChangeMemberRoleContext {
	companyId: string;
	actorId: string;
	actorRole: MembershipRole;
}

export interface ChangeMemberRoleDependencies {
	membershipRepository: MembershipRepository;
}

/**
 * Use case for changing a membership's role (MI-47).
 *
 * The matrix rules it applies, in order:
 *
 * 1. **The membership must be in the caller's company and still in the
 *    roster.** Anything else is a 404, identically for a foreign id and a
 *    nonexistent one.
 * 2. **Nobody changes their own role** (`change_own_role`, §5.8 invariant 3).
 *    This is the row that kills self-escalation, so it is checked before any
 *    permission, not after.
 * 3. **Removing the old role and assigning the new one each need permission.**
 *    Demoting an ADMIN to MEMBER needs `assign_admin` *and* `assign_member`, so
 *    an ADMIN cannot demote another ADMIN even though it could have assigned a
 *    MEMBER: §5.8 words the rows as "assign **or remove**".
 * 4. **The company must keep an active OWNER** (§5.8 invariant 4). Only an
 *    `ACTIVE` OWNER counts: an invitation to be an OWNER has not been accepted,
 *    so changing its role changes nothing about who keeps the company alive.
 *
 * Setting the role it already has is an idempotent no-op: it answers with the
 * membership untouched instead of inventing a conflict for a request that asks
 * for the state that is already true.
 */
export class ChangeMemberRoleUseCase {
	private readonly membershipRepository: MembershipRepository;

	constructor(dependencies: ChangeMemberRoleDependencies) {
		this.membershipRepository = dependencies.membershipRepository;
	}

	async execute(
		input: ChangeMemberRoleInput,
		context: ChangeMemberRoleContext,
	): Promise<Membership> {
		const membership = await this.requireRosterMembership(
			input.membershipId,
			context.companyId,
		);

		if (membership.userId !== null && membership.userId === context.actorId) {
			// §5.8: nobody changes their own role, not even an OWNER. Leaving is
			// the way out of a company you own, and it goes through DELETE.
			throw new InsufficientRoleError();
		}

		if (input.role === membership.role) {
			return membership;
		}

		this.assertCanRemove(context.actorRole, membership.role);
		this.assertCanAssign(context.actorRole, input.role);

		if (membership.status === "ACTIVE" && membership.role === "OWNER") {
			const activeOwners = await this.membershipRepository.countActiveOwners(
				context.companyId,
			);

			if (activeOwners <= 1) {
				throw new LastActiveOwnerError();
			}
		}

		const updated = await this.membershipRepository.updateRole(
			membership.id,
			input.role,
		);

		// Fail-closed: the guarded write refuses when the row left the roster
		// between the read and the write (a revocation, or a concurrent
		// change). Reporting success there would be a lie.
		if (updated === null) {
			throw new MembershipNotFoundError();
		}

		return updated;
	}

	/**
	 * Resolves a membership that belongs to the company the caller has context
	 * for and is still part of its roster.
	 *
	 * A `REVOKED` row answers the same 404 as a missing one: it is not a member
	 * any more, and the difference is not something the caller needs to know.
	 */
	private async requireRosterMembership(
		membershipId: string,
		companyId: string,
	): Promise<Membership> {
		const membership = await this.membershipRepository.findById(membershipId);

		if (
			membership === null ||
			membership.companyId !== companyId ||
			membership.status === "REVOKED"
		) {
			throw new MembershipNotFoundError();
		}

		return membership;
	}

	/** Removing a role needs the same permission as assigning it (§5.8). */
	private assertCanRemove(
		actorRole: MembershipRole,
		removedRole: MembershipRole,
	): void {
		if (!can(actorRole, assignmentActionForRole(removedRole))) {
			throw new InsufficientRoleError();
		}
	}

	private assertCanAssign(
		actorRole: MembershipRole,
		assignedRole: MembershipRole,
	): void {
		if (!can(actorRole, assignmentActionForRole(assignedRole))) {
			throw new InsufficientRoleError();
		}
	}
}
