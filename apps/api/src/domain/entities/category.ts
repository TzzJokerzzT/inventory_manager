import { DomainError } from "../errors/domain-error.js";

/**
 * Same cap as the product, customer and supplier name: the four are the "name"
 * of a master record and share one form field length on the client, so a value
 * that fits one fits all.
 */
const NAME_MAX_LENGTH = 120;

export interface CategoryProps {
	id: string;
	companyId: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateCategoryProps {
	companyId: string;
	name: string;
	id?: string;
	createdAt?: Date;
	updatedAt?: Date;
}

/** The fields a category write may change. The identity is not one of them. */
export interface CategoryChanges {
	name?: string;
}

function normalizeText(raw: string): string {
	return raw.trim();
}

/**
 * Category entity (S3: the table already models it).
 *
 * The factory validates every invariant before an instance can exist, so an
 * invalid `Category` is not representable: the company is required and the name
 * is 1..120 after trim. There is no soft-delete stamp on purpose: a category is
 * not audit history, so deleting one removes the row (S4) and this entity has
 * nothing to carry for it. No Express, Prisma or HTTP import belongs in this
 * file.
 *
 * The name is **not** case-folded, for the same reason as `Supplier.name`: it is
 * display text read back by a human, and the `@@unique([companyId, name])` index
 * is case-sensitive, so uniqueness is case-sensitive too. `Bebidas` and
 * `bebidas` are two different categories, and that is deliberate -- the adapters
 * (not this factory) are where the uniqueness rule lives, and two rows only
 * collide when the stored strings are equal.
 */
export class Category {
	private constructor(private readonly props: CategoryProps) {}

	static create(input: CreateCategoryProps): Category {
		const companyId = normalizeText(input.companyId);
		if (companyId.length === 0) {
			throw new DomainError("Category company id must not be empty");
		}

		const name = normalizeText(input.name);
		if (name.length === 0) {
			throw new DomainError("Category name must not be empty");
		}
		if (name.length > NAME_MAX_LENGTH) {
			throw new DomainError(
				`Category name must be at most ${NAME_MAX_LENGTH} characters`,
			);
		}

		return new Category({
			id: input.id ?? globalThis.crypto.randomUUID(),
			companyId,
			name,
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

	get createdAt(): Date {
		return this.props.createdAt;
	}

	get updatedAt(): Date {
		return this.props.updatedAt;
	}

	/**
	 * Builds the next state of this category, re-validating the name through the
	 * same factory. An absent change keeps the current name; the identity, the
	 * company and `createdAt` are preserved.
	 */
	withChanges(changes: CategoryChanges): Category {
		return Category.create({
			id: this.id,
			companyId: this.companyId,
			name: changes.name ?? this.name,
			createdAt: this.createdAt,
			updatedAt: new Date(),
		});
	}

	toJSON(): {
		id: string;
		companyId: string;
		name: string;
		createdAt: string;
		updatedAt: string;
	} {
		return {
			id: this.id,
			companyId: this.companyId,
			name: this.name,
			createdAt: this.createdAt.toISOString(),
			updatedAt: this.updatedAt.toISOString(),
		};
	}
}
