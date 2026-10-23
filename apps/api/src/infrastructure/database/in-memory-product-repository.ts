import { Product } from "../../domain/entities/product.js";
import { SkuAlreadyExistsError } from "../../domain/errors/sku-already-exists-error.js";
import type {
	ListProductsOptions,
	ProductRepository,
} from "../../domain/repositories/product-repository.js";

/**
 * In-memory adapter for the {@link ProductRepository} port.
 *
 * It mirrors the Prisma adapter's rules -- `deletedAt: null` on every active
 * read, company scoping inside the query, and SKU uniqueness per company
 * including the deleted rows -- so the two stay interchangeable behind the
 * port.
 *
 * The uniqueness check cannot lean on a database here, so this adapter
 * compares the rows itself. Skipping it would make the HTTP contract true only
 * in production and quietly false in the suite that runs against this adapter.
 */
export class InMemoryProductRepository implements ProductRepository {
	private readonly products: Map<string, Product>;

	/**
	 * `store` is adapter-specific and exists for the stock-movement ledger: the
	 * in-memory movement adapter applies stock changes to the very rows this
	 * repository serves, so both have to share one `Map` instead of keeping two
	 * copies that drift. It is not part of the port; production wires the Prisma
	 * adapters, where the shared state is the database.
	 */
	constructor(products: Product[] = [], store?: Map<string, Product>) {
		this.products = store ?? new Map<string, Product>();

		for (const product of products) {
			this.products.set(product.id, product);
		}
	}

	async create(product: Product): Promise<Product> {
		if (this.skuIsTaken(product.companyId, product.sku)) {
			throw new SkuAlreadyExistsError();
		}

		this.products.set(product.id, product);

		return product;
	}

	async findActiveById(
		companyId: string,
		productId: string,
	): Promise<Product | null> {
		const product = this.products.get(productId);

		// Same two conditions the Prisma adapter puts in the WHERE clause: the
		// company and the soft-delete stamp are part of the query, so a
		// soft-deleted product and a foreign one answer the same `null`.
		if (
			product === undefined ||
			product.companyId !== companyId ||
			product.deletedAt !== null
		) {
			return null;
		}

		return product;
	}

	async findBySku(companyId: string, sku: string): Promise<Product | null> {
		// No `deletedAt` filter on purpose: a deleted product keeps its SKU
		// reserved (L7).
		const product = Array.from(this.products.values()).find(
			(row) => row.companyId === companyId && row.sku === sku,
		);

		return product ?? null;
	}

	async findByIds(companyId: string, ids: string[]): Promise<Product[]> {
		// No `deletedAt` filter on purpose: this is the history read of the
		// stock movements, so a movement of a deleted product must stay
		// readable (MOV-05). The company filter stays, so a deleted product of
		// another company never resolves.
		const wanted = new Set(ids);

		return Array.from(this.products.values()).filter(
			(row) => row.companyId === companyId && wanted.has(row.id),
		);
	}

	async list(
		companyId: string,
		options: ListProductsOptions = {},
	): Promise<Product[]> {
		const needle = options.search?.trim().toLowerCase();
		// The trash replaces the active filter instead of being added to it: a
		// view that mixed both would serve neither (L3).
		const deleted = options.deleted === true;

		return Array.from(this.products.values())
			.filter(
				(row) =>
					row.companyId === companyId &&
					(deleted ? row.deletedAt !== null : row.deletedAt === null),
			)
			.filter(
				(row) =>
					needle === undefined ||
					needle.length === 0 ||
					row.name.toLowerCase().includes(needle) ||
					row.sku.toLowerCase().includes(needle),
			)
			.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
	}

	async update(product: Product): Promise<Product | null> {
		const existing = this.products.get(product.id);

		// The guarded write: an absent, foreign or already-deleted row is not
		// updated, exactly like `where: { ..., deletedAt: null }`.
		if (
			existing === undefined ||
			existing.companyId !== product.companyId ||
			existing.deletedAt !== null
		) {
			return null;
		}

		if (this.skuIsTaken(product.companyId, product.sku, product.id)) {
			throw new SkuAlreadyExistsError();
		}

		// The entity is immutable, so the update replaces the row under the same
		// id.
		this.products.set(product.id, product);

		return product;
	}

	async softDelete(
		companyId: string,
		productId: string,
	): Promise<Product | null> {
		const existing = this.products.get(productId);

		if (
			existing === undefined ||
			existing.companyId !== companyId ||
			existing.deletedAt !== null
		) {
			return null;
		}

		const deletedAt = new Date();
		const deleted = Product.create({
			id: existing.id,
			companyId: existing.companyId,
			name: existing.name,
			description: existing.description,
			sku: existing.sku,
			price: existing.price,
			photoUrl: existing.photoUrl,
			stockQuantity: existing.stockQuantity,
			lowStockThreshold: existing.lowStockThreshold,
			categoryId: existing.categoryId,
			deletedAt,
			createdAt: existing.createdAt,
			updatedAt: deletedAt,
		});

		// The row stays: the stock movements of MI-8 must keep pointing at a
		// readable product.
		this.products.set(deleted.id, deleted);

		return deleted;
	}

	async restore(companyId: string, productId: string): Promise<Product | null> {
		const existing = this.products.get(productId);

		// The mirror guard of `softDelete`: only a row that is actually in the
		// trash is written, so an active (or foreign, or absent) product answers
		// `null` and two concurrent restores resolve to one winner.
		if (
			existing === undefined ||
			existing.companyId !== companyId ||
			existing.deletedAt === null
		) {
			return null;
		}

		const restoredAt = new Date();
		const restored = Product.create({
			id: existing.id,
			companyId: existing.companyId,
			name: existing.name,
			description: existing.description,
			sku: existing.sku,
			price: existing.price,
			photoUrl: existing.photoUrl,
			stockQuantity: existing.stockQuantity,
			lowStockThreshold: existing.lowStockThreshold,
			categoryId: existing.categoryId,
			deletedAt: null,
			createdAt: existing.createdAt,
			updatedAt: restoredAt,
		});

		this.products.set(restored.id, restored);

		return restored;
	}

	/** Adapter-specific: lets the test suite insert products directly. */
	save(product: Product): void {
		this.products.set(product.id, product);
	}

	/**
	 * The per-company uniqueness rule, deleted rows included. `exceptId` is the
	 * product being updated, so keeping its own SKU is not a conflict.
	 */
	private skuIsTaken(
		companyId: string,
		sku: string,
		exceptId?: string,
	): boolean {
		return Array.from(this.products.values()).some(
			(row) =>
				row.companyId === companyId && row.sku === sku && row.id !== exceptId,
		);
	}
}
