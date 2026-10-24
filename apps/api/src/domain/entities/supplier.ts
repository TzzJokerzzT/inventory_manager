import { DomainError } from "../errors/domain-error.js";

/**
 * Same cap as the product and the customer name: the three are the "name" of a
 * master record and share one form field length on the client, so a value that
 * fits one fits all.
 */
const NAME_MAX_LENGTH = 120;

export interface SupplierProps {
	id: string;
	companyId: string;
	name: string;
	contact: string | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateSupplierProps {
	companyId: string;
	name: string;
	contact?: string | null;
	id?: string;
	deletedAt?: Date | null;
	createdAt?: Date;
	updatedAt?: Date;
}

/**
 * The fields a supplier write may change. The soft-delete stamp is absent on
 * purpose: only `DELETE .../suppliers/:supplierId` sets it.
 */
export interface SupplierChanges {
	name?: string;
	contact?: string | null;
}

function normalizeText(raw: string): string {
	return raw.trim();
}

/**
 * Normalizes the optional contact exactly like `User.normalizeFullName`: absent,
 * `null` and whitespace-only all mean "no contact", so "the client cleared the
 * box" and "the client never sent the field" cannot produce two different
 * stored values.
 *
 * There is no length cap here on purpose, and for the same reason as in
 * `User`: `maxLength` is an input rule owned by the HTTP validator, answered
 * with a 400 and an issue list. Enforcing it here would surface the same
 * mistake as a 422 from the domain error path instead.
 */
function normalizeContact(raw: string | null | undefined): string | null {
	if (raw === null || raw === undefined) {
		return null;
	}

	const value = normalizeText(raw);
	return value.length === 0 ? null : value;
}

/**
 * Supplier entity (S4: "El proveedor es una entidad con ABM").
 *
 * The factory validates every invariant before an instance can exist, so an
 * invalid `Supplier` is not representable: a name 1..120 after trim and an
 * optional contact (trimmed, blank as `null`). No Express, Prisma or HTTP
 * import belongs in this file.
 *
 * The name is **not** case-folded. Unlike `Product.sku` -- where uppercasing is
 * what makes "unique per company" mean what it says -- the supplier name is
 * display text read back by a human, so `Distribuidora Sur` must survive as
 * typed. The consequence is deliberate and mirrors the database: the
 * `@@unique([companyId, name])` index is case-sensitive, so uniqueness is
 * case-sensitive too, and the adapters (not this factory) are where that rule
 * lives -- two rows only collide when the stored strings are equal.
 */
export class Supplier {
	private constructor(private readonly props: SupplierProps) {}

	static create(input: CreateSupplierProps): Supplier {
		const companyId = normalizeText(input.companyId);
		if (companyId.length === 0) {
			throw new DomainError("Supplier company id must not be empty");
		}

		const name = normalizeText(input.name);
		if (name.length === 0) {
			throw new DomainError("Supplier name must not be empty");
		}
		if (name.length > NAME_MAX_LENGTH) {
			throw new DomainError(
				`Supplier name must be at most ${NAME_MAX_LENGTH} characters`,
			);
		}

		return new Supplier({
			id: input.id ?? globalThis.crypto.randomUUID(),
			companyId,
			name,
			contact: normalizeContact(input.contact),
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

	get contact(): string | null {
		return this.props.contact;
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
	 * Builds the next state of this supplier, re-validating the changed fields
	 * through the same factory. An absent change keeps the current value; an
	 * explicit `null` -- or an empty/whitespace-only string, which the factory
	 * normalizes the same way -- clears `contact` (the partial-update contract
	 * of `PATCH`). The identity, the company and `createdAt` are preserved.
	 */
	withChanges(changes: SupplierChanges): Supplier {
		return Supplier.create({
			id: this.id,
			companyId: this.companyId,
			name: changes.name ?? this.name,
			contact: changes.contact === undefined ? this.contact : changes.contact,
			deletedAt: this.deletedAt,
			createdAt: this.createdAt,
			updatedAt: new Date(),
		});
	}

	toJSON(): {
		id: string;
		companyId: string;
		name: string;
		contact: string | null;
		createdAt: string;
		updatedAt: string;
	} {
		return {
			id: this.id,
			companyId: this.companyId,
			name: this.name,
			contact: this.contact,
			createdAt: this.createdAt.toISOString(),
			updatedAt: this.updatedAt.toISOString(),
		};
	}
}
