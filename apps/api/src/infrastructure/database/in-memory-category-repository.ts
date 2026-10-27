import type { Category } from "../../domain/entities/category.js";
import { CategoryNameAlreadyExistsError } from "../../domain/errors/category-name-already-exists-error.js";
import type {
	CategoryRepository,
	DeleteCategoryResult,
} from "../../domain/repositories/category-repository.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";

/**
 * In-memory adapter for the {@link CategoryRepository} port.
 *
 * It mirrors the Prisma adapter's rules -- company scoping inside the query, the
 * same deterministic order, the same case-sensitive name uniqueness and the same
 * hard delete -- so the two stay interchangeable behind the port.
 *
 * The uniqueness check is the one place the two adapters must not share code:
 * here it is an explicit comparison over the rows, because there is no unique
 * index to lean on. Both answers are the same
 * {@link CategoryNameAlreadyExistsError}, so no use case can tell which store
 * answered.
 *
 * The delete guard needs to know which products point at a category, and in
 * production that is one `product.count` in the database. In memory there is no
 * shared store unless this adapter composes the product repository, so it takes
 * it as a dependency instead of keeping a second copy of the references: the
 * products stay in the one place that owns them.
 */
export class InMemoryCategoryRepository implements CategoryRepository {
	private readonly categories: Map<string, Category>;
	private readonly products: ProductRepository;

	constructor(products: ProductRepository, categories: Category[] = []) {
		this.products = products;
		this.categories = new Map<string, Category>();

		for (const category of categories) {
			this.categories.set(category.id, category);
		}
	}

	async create(category: Category): Promise<Category> {
		// Comparing the raw strings is exactly what the index does
		// (case-sensitive), never a lowercased comparison.
		if (this.isNameTaken(category.companyId, category.name, category.id)) {
			throw new CategoryNameAlreadyExistsError();
		}

		this.categories.set(category.id, category);

		return category;
	}

	async findById(
		companyId: string,
		categoryId: string,
	): Promise<Category | null> {
		const category = this.categories.get(categoryId);

		// The company is part of the query in the Prisma adapter too, so a foreign
		// category and an absent one answer the same `null`.
		if (category === undefined || category.companyId !== companyId) {
			return null;
		}

		return category;
	}

	async findByIds(companyId: string, ids: string[]): Promise<Category[]> {
		// The ids arrive deduplicated from the caller, and the `Set` keeps this
		// adapter answering one row per category even if one repeats: the batch
		// read is a lookup, never a join that multiplies rows.
		const wanted = new Set(ids);

		return Array.from(this.categories.values()).filter(
			(row) => row.companyId === companyId && wanted.has(row.id),
		);
	}

	async listByCompany(companyId: string): Promise<Category[]> {
		return Array.from(this.categories.values())
			.filter((row) => row.companyId === companyId)
			.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
	}

	async update(category: Category): Promise<Category | null> {
		const existing = this.categories.get(category.id);

		// The guarded write: an absent or foreign row is not updated, exactly like
		// `where: { ..., companyId }`.
		if (existing === undefined || existing.companyId !== category.companyId) {
			return null;
		}

		// The row itself is excluded from the collision check, so keeping its own
		// name is never a conflict.
		if (this.isNameTaken(category.companyId, category.name, category.id)) {
			throw new CategoryNameAlreadyExistsError();
		}

		// The entity is immutable, so the update replaces the row under the same
		// id.
		this.categories.set(category.id, category);

		return category;
	}

	async countProducts(companyId: string, categoryId: string): Promise<number> {
		// The product port reads the active catalogue and the trash as two
		// listings, while the foreign key covers both halves, so both are read and
		// summed. A soft-deleted product still blocks the delete.
		const [active, deleted] = await Promise.all([
			this.products.list(companyId, { deleted: false }),
			this.products.list(companyId, { deleted: true }),
		]);

		return [...active, ...deleted].filter(
			(product) => product.categoryId === categoryId,
		).length;
	}

	async delete(
		companyId: string,
		categoryId: string,
	): Promise<DeleteCategoryResult> {
		const existing = this.categories.get(categoryId);

		if (existing === undefined || existing.companyId !== companyId) {
			return "not_found";
		}

		// The same guard the database enforces with `ON DELETE RESTRICT`, checked
		// here because this adapter cannot rely on a foreign key.
		if ((await this.countProducts(companyId, categoryId)) > 0) {
			return "in_use";
		}

		// Hard delete: the row is removed for good, there is no stamp to keep.
		this.categories.delete(categoryId);

		return "deleted";
	}

	/** Adapter-specific: lets the test suite insert categories directly. */
	save(category: Category): void {
		this.categories.set(category.id, category);
	}

	/**
	 * The uniqueness rule of `@@unique([companyId, name])`, in memory: any row of
	 * the company with the same exact name collides -- case included -- and the
	 * row being written never collides with itself.
	 */
	private isNameTaken(
		companyId: string,
		name: string,
		ignoredId: string,
	): boolean {
		for (const row of this.categories.values()) {
			if (
				row.id !== ignoredId &&
				row.companyId === companyId &&
				row.name === name
			) {
				return true;
			}
		}

		return false;
	}
}
