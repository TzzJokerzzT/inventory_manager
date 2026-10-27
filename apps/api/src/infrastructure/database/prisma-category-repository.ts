import { Category } from "../../domain/entities/category.js";
import { CategoryNameAlreadyExistsError } from "../../domain/errors/category-name-already-exists-error.js";
import type {
	CategoryRepository,
	DeleteCategoryResult,
} from "../../domain/repositories/category-repository.js";
import type {
	Category as CategoryModel,
	PrismaClient,
} from "./generated/prisma/client.js";

/**
 * The adapter depends on the `category` delegate for the rows and on the
 * `product` delegate for the count that guards the delete. The type-only import
 * is on purpose: the generated client is ESM-first and Jest runs through
 * `@swc/jest` in CommonJS, so a runtime import would break the suite.
 */
type CategoryDelegate = Pick<PrismaClient, "category" | "product">;

/**
 * Prisma reports a unique-constraint violation as `P2002` and a foreign-key
 * violation as `P2003`. The checks are structural because the generated client
 * is imported type-only: there is no `Prisma.PrismaClientKnownRequestError`
 * value to narrow against.
 */
function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: unknown }).code === "P2002"
	);
}

function isForeignKeyViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: unknown }).code === "P2003"
	);
}

export interface PrismaCategoryRepositoryDependencies {
	prisma: CategoryDelegate;
}

/**
 * Prisma-backed adapter for the {@link CategoryRepository} port.
 *
 * Rows are always mapped back to the domain entity; a raw Prisma object never
 * crosses the port boundary. Every statement carries the `companyId` in its
 * WHERE clause (S4), so the isolation is decided by the query, and there is no
 * `deletedAt` anywhere because a category is hard-deleted.
 *
 * The name uniqueness is enforced by the `@@unique([companyId, name])` index and
 * translated here: `P2002` from a create or an update becomes
 * {@link CategoryNameAlreadyExistsError}, so the in-memory adapter and this one
 * answer the same error and no use case can tell which store answered.
 */
export class PrismaCategoryRepository implements CategoryRepository {
	private readonly prisma: CategoryDelegate;

	constructor(dependencies: PrismaCategoryRepositoryDependencies) {
		this.prisma = dependencies.prisma;
	}

	async create(category: Category): Promise<Category> {
		try {
			const row = await this.prisma.category.create({
				data: {
					id: category.id,
					companyId: category.companyId,
					name: category.name,
					createdAt: category.createdAt,
					updatedAt: category.updatedAt,
				},
			});

			return this.toDomain(row);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new CategoryNameAlreadyExistsError();
			}

			throw error;
		}
	}

	async findById(
		companyId: string,
		categoryId: string,
	): Promise<Category | null> {
		const row = await this.prisma.category.findFirst({
			where: { id: categoryId, companyId },
		});

		if (row === null) {
			return null;
		}

		return this.toDomain(row);
	}

	async findByIds(companyId: string, ids: string[]): Promise<Category[]> {
		// An empty `in` list is a query nobody needs: the caller asked for no
		// category, so the answer is no category.
		if (ids.length === 0) {
			return [];
		}

		const rows = await this.prisma.category.findMany({
			where: { companyId, id: { in: ids } },
		});

		return rows.map((row) => this.toDomain(row));
	}

	async listByCompany(companyId: string): Promise<Category[]> {
		const rows = await this.prisma.category.findMany({
			where: { companyId },
			// Deterministic order, so two reads of the same state answer the same
			// array.
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});

		return rows.map((row) => this.toDomain(row));
	}

	async update(category: Category): Promise<Category | null> {
		try {
			// `updateMany` (not `update`) because it accepts the extra `companyId`
			// predicate: the write only lands while the row still belongs to the
			// caller's company, so a delete racing this update wins instead of being
			// overwritten. The unique index still fires inside the statement, which
			// is why the `P2002` translation wraps it too.
			const { count } = await this.prisma.category.updateMany({
				where: { id: category.id, companyId: category.companyId },
				data: { name: category.name, updatedAt: category.updatedAt },
			});

			if (count === 0) {
				return null;
			}
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new CategoryNameAlreadyExistsError();
			}

			throw error;
		}

		return this.findById(category.companyId, category.id);
	}

	async countProducts(companyId: string, categoryId: string): Promise<number> {
		// No `deletedAt` predicate on purpose: the `ON DELETE RESTRICT` foreign key
		// covers the soft-deleted products too, so they block the delete as well.
		return this.prisma.product.count({ where: { companyId, categoryId } });
	}

	async delete(
		companyId: string,
		categoryId: string,
	): Promise<DeleteCategoryResult> {
		try {
			// One statement, with the company in the WHERE clause: an absent and a
			// foreign category both match no row and answer `not_found`.
			const { count } = await this.prisma.category.deleteMany({
				where: { id: categoryId, companyId },
			});

			return count === 0 ? "not_found" : "deleted";
		} catch (error) {
			// A product started pointing at the category between the count and this
			// delete: the foreign key rejected it, which is the same conflict the
			// count would have produced (S4).
			if (isForeignKeyViolation(error)) {
				return "in_use";
			}

			throw error;
		}
	}

	/** Maps a raw Prisma row back into the domain entity. */
	private toDomain(row: CategoryModel): Category {
		return Category.create({
			id: row.id,
			companyId: row.companyId,
			name: row.name,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}
}
