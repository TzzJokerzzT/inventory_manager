import { DomainError } from "../errors/domain-error.js";

/**
 * `price` regex, mirrored from the OpenAPI contract: up to ten integer digits
 * and up to two decimals. It is a *string* on purpose -- see
 * `odd/tasks/products.md` L5 -- because the column is `Decimal(12,2)` and a
 * float would lose precision at the first rounding.
 */
const PRICE_PATTERN = /^(\d{1,10})(?:\.(\d{1,2}))?$/;

const NAME_MAX_LENGTH = 120;
const SKU_MAX_LENGTH = 64;
const DESCRIPTION_MAX_LENGTH = 1000;
const PHOTO_URL_MAX_LENGTH = 2048;

export interface ProductProps {
	id: string;
	companyId: string;
	name: string;
	description: string | null;
	sku: string;
	price: string;
	photoUrl: string | null;
	stockQuantity: number;
	lowStockThreshold: number;
	categoryId: string | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateProductProps {
	companyId: string;
	name: string;
	sku: string;
	/** Decimal string; normalized to exactly two decimals by the factory. */
	price: string;
	description?: string | null;
	photoUrl?: string | null;
	/** Server-owned: only stock movements change it (MI-8). */
	stockQuantity?: number;
	/** Server-owned: keeps the database default until NOTIF-01/MI-12. */
	lowStockThreshold?: number;
	/** Categories have no feature yet, so this is always `null` today. */
	categoryId?: string | null;
	id?: string;
	deletedAt?: Date | null;
	createdAt?: Date;
	updatedAt?: Date;
}

/**
 * The fields a product write may change. `stockQuantity`, `lowStockThreshold`,
 * `categoryId` and the soft-delete stamp are absent on purpose: they are not
 * writable from the product endpoints.
 */
export interface ProductChanges {
	name?: string;
	description?: string | null;
	sku?: string;
	price?: string;
	photoUrl?: string | null;
}

/**
 * Normalizes a decimal price string to exactly two decimals with **string
 * manipulation**, never float math: `"1500"` -> `"1500.00"`, `"7.5"` ->
 * `"7.50"`, `"007.5"` -> `"7.50"`.
 */
function normalizePrice(raw: string): string {
	const match = PRICE_PATTERN.exec(raw.trim());
	if (match === null) {
		throw new DomainError(
			`Product price must be a decimal string with up to ten integer digits and up to two decimals: ${raw}`,
		);
	}

	const withoutLeadingZeros = match[1].replace(/^0+/, "");
	const integerPart =
		withoutLeadingZeros.length === 0 ? "0" : withoutLeadingZeros;
	const fractionPart = (match[2] ?? "").padEnd(2, "0");

	return `${integerPart}.${fractionPart}`;
}

function normalizeText(raw: string): string {
	return raw.trim();
}

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
			`Product ${label} must be at most ${maxLength} characters`,
		);
	}

	return value;
}

/**
 * Only `http`/`https` urls are accepted: the value is rendered as an `<img>`
 * source by the web client, so a `javascript:` or `data:` scheme must never be
 * storable. The empty string normalizes to `null`, like `description`.
 */
function normalizePhotoUrl(raw: string | null | undefined): string | null {
	const value = normalizeOptionalText(raw, "photo url", PHOTO_URL_MAX_LENGTH);
	if (value === null) {
		return null;
	}

	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new DomainError(`Product photo url must be a valid url: ${value}`);
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new DomainError(`Product photo url must use http or https: ${value}`);
	}

	return value;
}

function assertNonNegativeInteger(value: number, label: string): void {
	if (!Number.isInteger(value) || value < 0) {
		throw new DomainError(
			`Product ${label} must be a non-negative integer: ${value}`,
		);
	}
}

/**
 * Product entity.
 *
 * The factory validates every invariant before an instance can exist, so an
 * invalid `Product` is not representable: name 1..120 after trim, SKU 1..64
 * after trim and uppercased, a decimal `price` normalized to two decimals,
 * `description` <= 1000, `photoUrl` <= 2048 and http/https, and non-negative
 * integer stock counters. No Express, Prisma or HTTP import belongs in this
 * file.
 */
export class Product {
	private constructor(private readonly props: ProductProps) {}

	static create(input: CreateProductProps): Product {
		const companyId = normalizeText(input.companyId);
		if (companyId.length === 0) {
			throw new DomainError("Product company id must not be empty");
		}

		const name = normalizeText(input.name);
		if (name.length === 0) {
			throw new DomainError("Product name must not be empty");
		}
		if (name.length > NAME_MAX_LENGTH) {
			throw new DomainError(
				`Product name must be at most ${NAME_MAX_LENGTH} characters`,
			);
		}

		// The database's `@@unique([companyId, sku])` is case-sensitive, so the
		// normalization is what makes "unique per company" mean what it says
		// (odd/tasks/products.md L6).
		const sku = normalizeText(input.sku).toUpperCase();
		if (sku.length === 0) {
			throw new DomainError("Product SKU must not be empty");
		}
		if (sku.length > SKU_MAX_LENGTH) {
			throw new DomainError(
				`Product SKU must be at most ${SKU_MAX_LENGTH} characters`,
			);
		}

		const description = normalizeOptionalText(
			input.description,
			"description",
			DESCRIPTION_MAX_LENGTH,
		);
		const photoUrl = normalizePhotoUrl(input.photoUrl);

		const stockQuantity = input.stockQuantity ?? 0;
		assertNonNegativeInteger(stockQuantity, "stock quantity");

		const lowStockThreshold = input.lowStockThreshold ?? 0;
		assertNonNegativeInteger(lowStockThreshold, "low stock threshold");

		return new Product({
			id: input.id ?? globalThis.crypto.randomUUID(),
			companyId,
			name,
			description,
			sku,
			price: normalizePrice(input.price),
			photoUrl,
			stockQuantity,
			lowStockThreshold,
			categoryId: input.categoryId ?? null,
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

	get description(): string | null {
		return this.props.description;
	}

	get sku(): string {
		return this.props.sku;
	}

	get price(): string {
		return this.props.price;
	}

	get photoUrl(): string | null {
		return this.props.photoUrl;
	}

	get stockQuantity(): number {
		return this.props.stockQuantity;
	}

	get lowStockThreshold(): number {
		return this.props.lowStockThreshold;
	}

	get categoryId(): string | null {
		return this.props.categoryId;
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
	 * Builds the next state of this product with a new stock quantity.
	 *
	 * It exists so the stock ledger (MI-8) can apply a movement without writing
	 * the column outside the entity: the value is re-validated by the factory
	 * (a non-negative integer) and every other field is carried over untouched.
	 * `updatedAt` is preserved on purpose, because the Prisma adapter's guarded
	 * stock update does not stamp it either; keeping the two adapters
	 * interchangeable matters more than a timestamp the movement itself
	 * carries.
	 */
	withStock(quantity: number): Product {
		return Product.create({
			id: this.id,
			companyId: this.companyId,
			name: this.name,
			description: this.description,
			sku: this.sku,
			price: this.price,
			photoUrl: this.photoUrl,
			stockQuantity: quantity,
			lowStockThreshold: this.lowStockThreshold,
			categoryId: this.categoryId,
			deletedAt: this.deletedAt,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
		});
	}

	/**
	 * Builds the next state of this product, re-validating the changed fields
	 * through the same factory. An absent change keeps the current value; an
	 * explicit `null` clears `description` or `photoUrl` (the partial-update
	 * contract of `PATCH`). The server-owned fields are carried over untouched.
	 */
	withChanges(changes: ProductChanges): Product {
		return Product.create({
			id: this.id,
			companyId: this.companyId,
			name: changes.name ?? this.name,
			description:
				changes.description === undefined
					? this.description
					: changes.description,
			sku: changes.sku ?? this.sku,
			price: changes.price ?? this.price,
			photoUrl:
				changes.photoUrl === undefined ? this.photoUrl : changes.photoUrl,
			stockQuantity: this.stockQuantity,
			lowStockThreshold: this.lowStockThreshold,
			categoryId: this.categoryId,
			deletedAt: this.deletedAt,
			createdAt: this.createdAt,
			updatedAt: new Date(),
		});
	}

	toJSON(): {
		id: string;
		companyId: string;
		name: string;
		description: string | null;
		sku: string;
		price: string;
		photoUrl: string | null;
		stockQuantity: number;
		lowStockThreshold: number;
		categoryId: string | null;
		createdAt: string;
		updatedAt: string;
	} {
		return {
			id: this.id,
			companyId: this.companyId,
			name: this.name,
			description: this.description,
			sku: this.sku,
			price: this.price,
			photoUrl: this.photoUrl,
			stockQuantity: this.stockQuantity,
			lowStockThreshold: this.lowStockThreshold,
			categoryId: this.categoryId,
			createdAt: this.createdAt.toISOString(),
			updatedAt: this.updatedAt.toISOString(),
		};
	}
}
