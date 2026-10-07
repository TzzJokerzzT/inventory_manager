import { DomainError } from "../errors/domain-error.js";

export interface UserProps {
	id: string;
	auth0Sub: string;
	email: string;
	createdAt: Date;
}

export interface CreateUserProps {
	auth0Sub: string;
	email: string;
	id?: string;
	createdAt?: Date;
}

/**
 * User entity.
 *
 * The factory validates the invariants before an instance can exist, so an
 * invalid `User` is not representable. No Express, Prisma or HTTP import
 * belongs in this file.
 *
 * The lowercase-email invariant lives here, not in the Prisma adapter: the
 * database enforces `email = lower(email)` with a CHECK, so an entity that
 * lowercases on construction makes it impossible to hand a non-lowercase
 * email to any adapter that persists it.
 */
export class User {
	private constructor(private readonly props: UserProps) {}

	static create(input: CreateUserProps): User {
		const auth0Sub = input.auth0Sub.trim();
		if (auth0Sub.length === 0) {
			throw new DomainError("User auth0 sub must not be empty");
		}

		// Lowercase is a persistence invariant enforced by the database
		// (`CHECK (email = lower(email))`), so the value is normalised the
		// moment the entity exists rather than trusting every adapter.
		const email = input.email.trim().toLowerCase();
		if (email.length === 0) {
			throw new DomainError("User email must not be empty");
		}

		return new User({
			id: input.id ?? globalThis.crypto.randomUUID(),
			auth0Sub,
			email,
			createdAt: input.createdAt ?? new Date(),
		});
	}

	get id(): string {
		return this.props.id;
	}

	get auth0Sub(): string {
		return this.props.auth0Sub;
	}

	get email(): string {
		return this.props.email;
	}

	get createdAt(): Date {
		return this.props.createdAt;
	}

	toJSON(): { id: string; auth0Sub: string; email: string; createdAt: string } {
		return {
			id: this.id,
			auth0Sub: this.auth0Sub,
			email: this.email,
			createdAt: this.createdAt.toISOString(),
		};
	}
}
