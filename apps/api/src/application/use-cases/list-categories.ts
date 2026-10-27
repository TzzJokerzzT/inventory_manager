import type { Category } from "../../domain/entities/category.js";
import type { CategoryRepository } from "../../domain/repositories/category-repository.js";

export interface ListCategoriesContext {
	/** The company whose categories are being read. */
	companyId: string;
}

export interface ListCategoriesDependencies {
	categoryRepository: CategoryRepository;
}

/**
 * Use case for listing a company's categories (S4).
 *
 * Reading needs **no role**: the company context already proved an ACTIVE
 * membership, and `manage_products` only discriminates on writes (OWNER and
 * ADMIN write, MEMBER reads). The scoping is the `companyId` in the query, not a
 * filter here, so a caller can only ever see the categories of a company they
 * belong to.
 *
 * Ordering (`name`, then `id`) belongs to the adapter, so both adapters answer
 * the same array for the same state.
 */
export class ListCategoriesUseCase {
	private readonly categoryRepository: CategoryRepository;

	constructor(dependencies: ListCategoriesDependencies) {
		this.categoryRepository = dependencies.categoryRepository;
	}

	async execute(context: ListCategoriesContext): Promise<Category[]> {
		return this.categoryRepository.listByCompany(context.companyId);
	}
}
