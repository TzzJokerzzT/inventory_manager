import { DomainError } from "../errors/domain-error.js";

const MEMBERSHIP_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

const MEMBERSHIP_STATUSES = ["INVITED", "ACTIVE", "REVOKED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export interface MembershipProps {
	id: string;
	userId: string | null;
	invitedEmail: string;
	companyId: string;
	role: MembershipRole;
	status: MembershipStatus;
	invitedBy: string;
	acceptedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateMembershipProps {
	userId: string | null;
	invitedEmail: string;
	companyId: string;
	role: MembershipRole;
	status: MembershipStatus;
	invitedBy: string;
	acceptedAt?: Date | null;
	id?: string;
	createdAt?: Date;
	updatedAt?: Date;
}

/**
 * Membership entity.
 *
 * It mirrors the `memberships` table: `userId` is nullable on purpose because
 * the invitation exists before the account does, and `invitedEmail` is
 * lowercased so the join key against `users.email` stays canonical (both are
 * enforced by CHECK constraints in the first migration). The roles and
 * statuses are the domain's own string unions, not Prisma enums leaking
 * inward: no Prisma or HTTP import belongs in this file.
 */
export class Membership {
	private constructor(private readonly props: MembershipProps) {}

	static create(input: CreateMembershipProps): Membership {
		// Lowercase is a persistence invariant enforced by the database
		// (`CHECK (invited_email = lower(invited_email))`), so the value is
		// normalised the moment the entity exists rather than trusting every
		// adapter.
		const invitedEmail = input.invitedEmail.trim().toLowerCase();
		if (invitedEmail.length === 0) {
			throw new DomainError("Membership invited email must not be empty");
		}

		const companyId = input.companyId.trim();
		if (companyId.length === 0) {
			throw new DomainError("Membership company id must not be empty");
		}

		const invitedBy = input.invitedBy.trim();
		if (invitedBy.length === 0) {
			throw new DomainError("Membership inviter id must not be empty");
		}

		if (!MEMBERSHIP_ROLES.includes(input.role)) {
			throw new DomainError(`Unknown membership role: ${input.role}`);
		}

		if (!MEMBERSHIP_STATUSES.includes(input.status)) {
			throw new DomainError(`Unknown membership status: ${input.status}`);
		}

		return new Membership({
			id: input.id ?? globalThis.crypto.randomUUID(),
			userId: input.userId,
			invitedEmail,
			companyId,
			role: input.role,
			status: input.status,
			invitedBy,
			acceptedAt: input.acceptedAt ?? null,
			createdAt: input.createdAt ?? new Date(),
			updatedAt: input.updatedAt ?? new Date(),
		});
	}

	get id(): string {
		return this.props.id;
	}

	get userId(): string | null {
		return this.props.userId;
	}

	get invitedEmail(): string {
		return this.props.invitedEmail;
	}

	get companyId(): string {
		return this.props.companyId;
	}

	get role(): MembershipRole {
		return this.props.role;
	}

	get status(): MembershipStatus {
		return this.props.status;
	}

	get invitedBy(): string {
		return this.props.invitedBy;
	}

	get acceptedAt(): Date | null {
		return this.props.acceptedAt;
	}

	get createdAt(): Date {
		return this.props.createdAt;
	}

	get updatedAt(): Date {
		return this.props.updatedAt;
	}

	toJSON(): {
		id: string;
		userId: string | null;
		invitedEmail: string;
		companyId: string;
		role: MembershipRole;
		status: MembershipStatus;
		invitedBy: string;
		acceptedAt: string | null;
		createdAt: string;
		updatedAt: string;
	} {
		return {
			id: this.id,
			userId: this.userId,
			invitedEmail: this.invitedEmail,
			companyId: this.companyId,
			role: this.role,
			status: this.status,
			invitedBy: this.invitedBy,
			acceptedAt: this.acceptedAt?.toISOString() ?? null,
			createdAt: this.createdAt.toISOString(),
			updatedAt: this.updatedAt.toISOString(),
		};
	}
}
