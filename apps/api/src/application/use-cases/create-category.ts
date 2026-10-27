import { Category } from "../../domain/entities/category.js";
import type { MembershipRole } from "../../domain/entities/membership.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { CategoryRepository } from "../../domain/repositories/category-repository.js";

export interface CreateCategoryInput {
	name: string;
}

export interface CreateCategoryContext {
	/** The company the category belongs to; it comes from the resolved context. */
	companyId: string;
	actorRole: MembershipRole;
}

export interface CreateCategoryDependencies {
	categoryRepository: CategoryRepository;
}

/**
 * Use case for creating a category (S4).
 *
 * The order of the rules is part of the contract:
 *
 * 1. **`manage_products` first** -- writing the category catalogue is the same
 *    permission as writing the product catalogue (OWNER and ADMIN write, MEMBER
 *    reads), and no new action is added to the matrix for it. A MEMBER must
 *    never learn whether a body is valid, so the role is checked before the
 *    entity validates anything.
 * 2. **The body is validated by the entity**, not here: one place decides what
 *    a valid category is, so a value that reaches the adapter is already
 *    normalized (trimmed name).
 * 3. **The name must be free in this company, case-sensitively** -- the
 *    repository answers {@link CategoryNameAlreadyExistsError}, which the HTTP
 *    layer maps to 409. The read is not repeated here: the unique index is the
 *    authority for two concurrent creates, and both adapters translate it to the
 *    same error.
 *
 * Only the fields of this input are accepted, so an unknown body key never
 * reaches the entity.
 */
export class CreateCategoryUseCase {
	private readonly categoryRepository: CategoryRepository;

	constructor(dependencies: CreateCategoryDependencies) {
		this.categoryRepository = dependencies.categoryRepository;
	}

	async execute(
		input: CreateCategoryInput,
		context: CreateCategoryContext,
	): Promise<Category> {
		if (!can(context.actorRole, "manage_products")) {
			throw new InsufficientRoleError();
		}

		const category = Category.create({
			companyId: context.companyId,
			name: input.name,
		});

		return this.categoryRepository.create(category);
	}
}
