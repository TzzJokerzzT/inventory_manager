import type {
	Membership,
	MembershipRole,
} from "../../domain/entities/membership.js";
import { LastActiveOwnerError } from "../../domain/errors/last-active-owner-error.js";
import { MembershipNotFoundError } from "../../domain/errors/membership-not-found-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";

export interface LeaveCompanyContext {
	companyId: string;
	actorId: string;
	actorRole: MembershipRole;
}

export interface LeaveCompanyDependencies {
	membershipRepository: MembershipRepository;
}

/**
 * Use case for leaving a company (MI-47, EMP-10).
 *
 * It is the explicit self-service door: the caller leaves the company it has
 * context for, without having to know its own membership id (which `/me` does
 * not expose). The membership is resolved from the caller, never from the
 * request, so this endpoint can only ever revoke the caller's own access.
 *
 * §5.8 allows anyone to leave **except the last active OWNER**: a company with
 * no OWNER is an unrecoverable state (invariant 4), so the refusal is a 409
 * about the company, not a 403 about the caller's role.
 *
 * Revoking, not deleting: the row keeps the historical movements readable.
 */
export class LeaveCompanyUseCase {
	private readonly membershipRepository: MembershipRepository;

	constructor(dependencies: LeaveCompanyDependencies) {
		this.membershipRepository = dependencies.membershipRepository;
	}

	async execute(context: LeaveCompanyContext): Promise<Membership> {
		const membership =
			await this.membershipRepository.findActiveByUserAndCompany(
				context.actorId,
				context.companyId,
			);

		// The company context already proved this ACTIVE membership exists, so
		// reaching here without one is a race (a concurrent revocation), not a
		// forbidden access: fail closed with the same 404 the roster uses.
		if (membership === null) {
			throw new MembershipNotFoundError();
		}

		const isLastActiveOwner =
			membership.role === "OWNER"
				? (await this.membershipRepository.countActiveOwners(
						context.companyId,
					)) <= 1
				: false;

		// `findActiveByUserAndCompany` only ever returns ACTIVE rows, so the
		// role is what decides here; the matrix row keeps the rule in one place.
		if (!can(context.actorRole, "leave", isLastActiveOwner)) {
			throw new LastActiveOwnerError();
		}

		const revoked = await this.membershipRepository.revoke(membership.id);

		if (revoked === null) {
			throw new MembershipNotFoundError();
		}

		return revoked;
	}
}
