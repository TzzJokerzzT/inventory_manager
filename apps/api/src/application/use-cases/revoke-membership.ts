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

export interface RevokeMembershipInput {
	membershipId: string;
}

export interface RevokeMembershipContext {
	companyId: string;
	actorId: string;
	actorRole: MembershipRole;
}

export interface RevokeMembershipDependencies {
	membershipRepository: MembershipRepository;
}

/**
 * Use case for revoking a membership (MI-47).
 *
 * Revoking is `status = REVOKED`, never `DELETE` (§5.8): the row has to stay so
 * the historical stock movements keep pointing at a readable user (MOV-05).
 *
 * Two different rules meet here, and which one applies depends on **whose**
 * membership it is:
 *
 * - **Somebody else's**: removing their role needs the same permission as
 *   assigning it (`assign_member` / `assign_admin` / `assign_owner`), so an
 *   ADMIN can revoke a MEMBER but not another ADMIN.
 * - **Your own**: that is leaving, not removing, and §5.8 allows it for anyone
 *   except the last active OWNER. It is routed through the `leave` row of the
 *   matrix so the self case cannot drift from `/members/me`.
 *
 * In both cases the company must keep an active OWNER (§5.8 invariant 4); when
 * the caller is an OWNER revoking another OWNER there are at least two by
 * definition, so the guard is what makes the last-OWNER case impossible rather
 * than merely unlikely.
 */
export class RevokeMembershipUseCase {
	private readonly membershipRepository: MembershipRepository;

	constructor(dependencies: RevokeMembershipDependencies) {
		this.membershipRepository = dependencies.membershipRepository;
	}

	async execute(
		input: RevokeMembershipInput,
		context: RevokeMembershipContext,
	): Promise<Membership> {
		const membership = await this.requireRosterMembership(
			input.membershipId,
			context.companyId,
		);

		const isSelf =
			membership.userId !== null && membership.userId === context.actorId;

		if (isSelf) {
			await this.assertCanLeave(membership, context);
		} else {
			this.assertCanRemove(context.actorRole, membership.role);
			await this.assertAnActiveOwnerRemains(membership, context.companyId);
		}

		const revoked = await this.membershipRepository.revoke(membership.id);

		// Fail-closed: the guarded write refuses when the row already left the
		// roster, so a racing revocation does not get reported as this one.
		if (revoked === null) {
			throw new MembershipNotFoundError();
		}

		return revoked;
	}

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

	private assertCanRemove(
		actorRole: MembershipRole,
		removedRole: MembershipRole,
	): void {
		if (!can(actorRole, assignmentActionForRole(removedRole))) {
			throw new InsufficientRoleError();
		}
	}

	/**
	 * Applies the `leave` row: anyone may leave, except the last active OWNER.
	 *
	 * The predicate is fail-closed -- `isLastActiveOwner` defaults to `true` --
	 * so the count is computed only to relax it, and a denial is always the
	 * answer when the count says the company would be left ownerless.
	 */
	private async assertCanLeave(
		membership: Membership,
		context: RevokeMembershipContext,
	): Promise<void> {
		const isLastActiveOwner =
			membership.status === "ACTIVE" && membership.role === "OWNER"
				? (await this.membershipRepository.countActiveOwners(
						context.companyId,
					)) <= 1
				: false;

		if (!can(context.actorRole, "leave", isLastActiveOwner)) {
			throw new LastActiveOwnerError();
		}
	}

	private async assertAnActiveOwnerRemains(
		membership: Membership,
		companyId: string,
	): Promise<void> {
		if (membership.status !== "ACTIVE" || membership.role !== "OWNER") {
			return;
		}

		const activeOwners =
			await this.membershipRepository.countActiveOwners(companyId);

		if (activeOwners <= 1) {
			throw new LastActiveOwnerError();
		}
	}
}
