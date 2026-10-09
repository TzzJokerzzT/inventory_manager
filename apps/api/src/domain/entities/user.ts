import { DomainError } from "../errors/domain-error.js";

export interface UserProps {
	id: string;
	auth0Sub: string;
	email: string;
	fullName: string | null;
	createdAt: Date;
}

export interface CreateUserProps {
	auth0Sub: string;
	email: string;
	fullName?: string | null;
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
 *
 * The `fullName` normalisation (`null`, `""` and whitespace-only all mean "no
 * name") lives here for the same reason: it is a representation invariant, so
 * every adapter that writes a name -- the Prisma one and the test double --
 * routes through {@link User.normalizeFullName} instead of re-implementing the
 * rule and drifting. The HTTP layer deliberately does NOT own it: there `""`
 * is a valid "clear the name" input, not a validation failure.
 */
export class User {
	private constructor(private readonly props: UserProps) {}

	/**
	 * The single normalisation point for a display name: surrounding whitespace
	 * is dropped and an empty or whitespace-only value collapses to `null`
	 * ("no name set"), so the three equivalent inputs cannot produce two
	 * different stored values.
	 *
	 * A length cap is deliberately absent: `maxLength(120)` is an input rule
	 * owned by the HTTP validator and answered with 400. Enforcing it here would
	 * surface as a 422 from the domain error path instead of the contract's 400.
	 */
	static normalizeFullName(value: string | null): string | null {
		if (value === null) {
			return null;
		}

		const trimmed = value.trim();
		return trimmed.length === 0 ? null : trimmed;
	}

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
			fullName: User.normalizeFullName(input.fullName ?? null),
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

	get fullName(): string | null {
		return this.props.fullName;
	}

	get createdAt(): Date {
		return this.props.createdAt;
	}

	toJSON(): {
		id: string;
		auth0Sub: string;
		email: string;
		fullName: string | null;
		createdAt: string;
	} {
		return {
			id: this.id,
			auth0Sub: this.auth0Sub,
			email: this.email,
			fullName: this.fullName,
			createdAt: this.createdAt.toISOString(),
		};
	}
}
