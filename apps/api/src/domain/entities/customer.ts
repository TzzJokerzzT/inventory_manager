import { DomainError } from "../errors/domain-error.js";

/**
 * Shape check for the email, mirrored from the OpenAPI contract: one `@` with
 * a non-empty local part and a dotted domain. It is deliberately simple -- the
 * address is contact data, not a credential, and the only thing that matters
 * here is that an obvious typo never reaches the roster.
 */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * A phone is written by a human, so digits plus the punctuation a phone number
 * is typed with are accepted: `+`, `-`, `(`, `)`, `.` and the space.
 */
const PHONE_PATTERN = /^[0-9+\-(). ]+$/;

const NAME_MAX_LENGTH = 120;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MAX_LENGTH = 40;
const ADDRESS_MAX_LENGTH = 300;

export interface CustomerProps {
	id: string;
	companyId: string;
	name: string;
	email: string | null;
	phone: string | null;
	address: string | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateCustomerProps {
	companyId: string;
	name: string;
	email?: string | null;
	phone?: string | null;
	address?: string | null;
	id?: string;
	deletedAt?: Date | null;
	createdAt?: Date;
	updatedAt?: Date;
}

/**
 * The fields a customer write may change. The soft-delete stamp is absent on
 * purpose: only `DELETE .../customers/:customerId` sets it.
 */
export interface CustomerChanges {
	name?: string;
	email?: string | null;
	phone?: string | null;
	address?: string | null;
}

function normalizeText(raw: string): string {
	return raw.trim();
}

/**
 * Normalizes an optional contact field: absent and whitespace-only values are
 * stored as `null`, so "the client cleared the box" and "the client never sent
 * the field" are the same state.
 */
function normalizeOptionalText(
	raw: string | null | undefined,
	label: string,
	maxLength: number,
): string | null {
	if (raw === null || raw === undefined) {
		return null;
	}

	const value = normalizeText(raw);
	if (value.length === 0) {
		return null;
	}

	if (value.length > maxLength) {
		throw new DomainError(
			`Customer ${label} must be at most ${maxLength} characters`,
		);
	}

	return value;
}

/**
 * Emails are stored **lowercased** so the search and every comparison are
 * canonical (`MARIA@Example.COM` and `maria@example.com` are one customer).
 *
 * There is no uniqueness rule on purpose: the database has no unique index for
 * the email, so two customers of the same company may share one
 * (`odd/tasks/customers.md` L4).
 */
function normalizeEmail(raw: string | null | undefined): string | null {
	const value = normalizeOptionalText(raw, "email", EMAIL_MAX_LENGTH);
	if (value === null) {
		return null;
	}

	const email = value.toLowerCase();
	if (!EMAIL_PATTERN.test(email)) {
		throw new DomainError(`Customer email must be a valid email: ${value}`);
	}

	return email;
}

function normalizePhone(raw: string | null | undefined): string | null {
	const value = normalizeOptionalText(raw, "phone", PHONE_MAX_LENGTH);
	if (value === null) {
		return null;
	}

	if (!PHONE_PATTERN.test(value)) {
		throw new DomainError(
			`Customer phone must contain only digits and + - ( ) . and spaces: ${value}`,
		);
	}

	return value;
}

function normalizeAddress(raw: string | null | undefined): string | null {
	return normalizeOptionalText(raw, "address", ADDRESS_MAX_LENGTH);
}

/**
 * Customer entity.
 *
 * The factory validates every invariant before an instance can exist, so an
 * invalid `Customer` is not representable: a name 1..120 after trim, an
 * optional email (trimmed, lowercased, valid shape, <= 254), an optional phone
 * (<= 40, digits plus `+ - ( ) . space`) and an optional address (<= 300). An
 * empty or whitespace-only contact field is `null`. No Express, Prisma or HTTP
 * import belongs in this file.
 */
export class Customer {
	private constructor(private readonly props: CustomerProps) {}

	static create(input: CreateCustomerProps): Customer {
		const companyId = normalizeText(input.companyId);
		if (companyId.length === 0) {
			throw new DomainError("Customer company id must not be empty");
		}

		const name = normalizeText(input.name);
		if (name.length === 0) {
			throw new DomainError("Customer name must not be empty");
		}
		if (name.length > NAME_MAX_LENGTH) {
			throw new DomainError(
				`Customer name must be at most ${NAME_MAX_LENGTH} characters`,
			);
		}

		return new Customer({
			id: input.id ?? globalThis.crypto.randomUUID(),
			companyId,
			name,
			email: normalizeEmail(input.email),
			phone: normalizePhone(input.phone),
			address: normalizeAddress(input.address),
			deletedAt: input.deletedAt ?? null,
			createdAt: input.createdAt ?? new Date(),
			updatedAt: input.updatedAt ?? new Date(),
		});
	}

	get id(): string {
		return this.props.id;
	}

	get companyId(): string {
		return this.props.companyId;
	}

	get name(): string {
		return this.props.name;
	}

	get email(): string | null {
		return this.props.email;
	}

	get phone(): string | null {
		return this.props.phone;
	}

	get address(): string | null {
		return this.props.address;
	}

	get deletedAt(): Date | null {
		return this.props.deletedAt;
	}

	get createdAt(): Date {
		return this.props.createdAt;
	}

	get updatedAt(): Date {
		return this.props.updatedAt;
	}

	/**
	 * Builds the next state of this customer, re-validating the changed fields
	 * through the same factory. An absent change keeps the current value; an
	 * explicit `null` -- or an empty/whitespace-only string, which the factory
	 * normalizes the same way -- clears `email`, `phone` or `address` (the
	 * partial-update contract of `PATCH`). The identity, the company and
	 * `createdAt` are preserved.
	 */
	withChanges(changes: CustomerChanges): Customer {
		return Customer.create({
			id: this.id,
			companyId: this.companyId,
			name: changes.name ?? this.name,
			email: changes.email === undefined ? this.email : changes.email,
			phone: changes.phone === undefined ? this.phone : changes.phone,
			address: changes.address === undefined ? this.address : changes.address,
			deletedAt: this.deletedAt,
			createdAt: this.createdAt,
			updatedAt: new Date(),
		});
	}

	toJSON(): {
		id: string;
		companyId: string;
		name: string;
		email: string | null;
		phone: string | null;
		address: string | null;
		createdAt: string;
		updatedAt: string;
	} {
		return {
			id: this.id,
			companyId: this.companyId,
			name: this.name,
			email: this.email,
			phone: this.phone,
			address: this.address,
			createdAt: this.createdAt.toISOString(),
			updatedAt: this.updatedAt.toISOString(),
		};
	}
}
