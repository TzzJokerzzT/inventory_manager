import type { Category } from "../../domain/entities/category.js";
import type { MembershipRole } from "../../domain/entities/membership.js";
import { CategoryNotFoundError } from "../../domain/errors/category-not-found-error.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { CategoryRepository } from "../../domain/repositories/category-repository.js";

export interface UpdateCategoryInput {
	categoryId: string;
	/** Absent means "unchanged". */
	name?: string;
}

export interface UpdateCategoryContext {
	companyId: string;
	actorRole: MembershipRole;
}

export interface UpdateCategoryDependencies {
	categoryRepository: CategoryRepository;
}

/**
 * Use case for the rename of a category (S4, the "M" of the ABM).
 *
 * The order mirrors the create case: role first (`manage_products`), then the
 * category must exist in this company, then the merged state is re-validated by
 * the entity, then the guarded write. A rename onto a name the company already
 * uses -- keeping its own name is not a conflict -- is answered by the
 * repository with {@link CategoryNameAlreadyExistsError} and mapped to 409.
 *
 * A guarded write that matched no row means the category was deleted between the
 * read and the write, which is reported as the same 404 instead of a successful
 * update.
 */
export class UpdateCategoryUseCase {
	private readonly categoryRepository: CategoryRepository;

	constructor(dependencies: UpdateCategoryDependencies) {
		this.categoryRepository = dependencies.categoryRepository;
	}

	async execute(
		input: UpdateCategoryInput,
		context: UpdateCategoryContext,
	): Promise<Category> {
		if (!can(context.actorRole, "manage_products")) {
			throw new InsufficientRoleError();
		}

		const current = await this.categoryRepository.findById(
			context.companyId,
			input.categoryId,
		);

		if (current === null) {
			throw new CategoryNotFoundError();
		}

		const updated = current.withChanges({ name: input.name });

		const stored = await this.categoryRepository.update(updated);

		// Fail-closed: the guarded write refuses when the row was deleted between
		// the read and the write, so a delete racing this update is not reported
		// as a successful update.
		if (stored === null) {
			throw new CategoryNotFoundError();
		}

		return stored;
	}
}
