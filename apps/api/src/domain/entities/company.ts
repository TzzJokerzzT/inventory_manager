import { DomainError } from "../errors/domain-error.js";

export interface CompanyProps {
	id: string;
	name: string;
	createdAt: Date;
}

export interface CreateCompanyProps {
	name: string;
	id?: string;
	createdAt?: Date;
}

/**
 * Company entity.
 *
 * The factory validates the invariants before an instance can exist, so an
 * invalid `Company` is not representable. No Express, Prisma or HTTP import
 * belongs in this file.
 */
export class Company {
	private constructor(private readonly props: CompanyProps) {}

	static create(input: CreateCompanyProps): Company {
		const name = input.name.trim();
		if (name.length === 0) {
			throw new DomainError("Company name must not be empty");
		}

		return new Company({
			id: input.id ?? globalThis.crypto.randomUUID(),
			name,
			createdAt: input.createdAt ?? new Date(),
		});
	}

	get id(): string {
		return this.props.id;
	}

	get name(): string {
		return this.props.name;
	}

	get createdAt(): Date {
		return this.props.createdAt;
	}

	toJSON(): { id: string; name: string; createdAt: string } {
		return {
			id: this.id,
			name: this.name,
			createdAt: this.createdAt.toISOString(),
		};
	}
}
