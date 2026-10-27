import type { MembershipRole } from "../../domain/entities/membership.js";
import { CategoryInUseError } from "../../domain/errors/category-in-use-error.js";
import { CategoryNotFoundError } from "../../domain/errors/category-not-found-error.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { CategoryRepository } from "../../domain/repositories/category-repository.js";

export interface DeleteCategoryInput {
	categoryId: string;
}

export interface DeleteCategoryContext {
	companyId: string;
	actorRole: MembershipRole;
}

export interface DeleteCategoryDependencies {
	categoryRepository: CategoryRepository;
}

/**
 * Use case for the hard delete of a category (S4, the "B" of the ABM).
 *
 * The rules, in order, are the contract:
 *
 * 1. **`manage_products` first**, before the count and the delete, so a MEMBER
 *    never learns anything about the id it named.
 * 2. **The count comes before the delete.** A category that products of the
 *    company still reference answers `409 category_in_use` carrying the number,
 *    and the delete is never attempted; the count includes the soft-deleted
 *    products because the foreign key is `RESTRICT` for every row, so deleting
 *    the category anyway would be rejected by the database.
 * 3. **The delete is the guarded write**: it only matches a row of the company,
 *    so an absent or foreign category is the same `404 category_not_found`.
 * 4. **The race has the same answer as the count.** A product can start
 *    pointing at the category between the count and the `DELETE`; the database
 *    rejects the row and the adapter reports `in_use`, which this use case maps
 *    to the same 409 -- never a 500.
 *
 * There is no soft delete: a category is not audit history, and the endpoint
 * answers `204` with nothing to return.
 */
export class DeleteCategoryUseCase {
	private readonly categoryRepository: CategoryRepository;

	constructor(dependencies: DeleteCategoryDependencies) {
		this.categoryRepository = dependencies.categoryRepository;
	}

	async execute(
		input: DeleteCategoryInput,
		context: DeleteCategoryContext,
	): Promise<void> {
		if (!can(context.actorRole, "manage_products")) {
			throw new InsufficientRoleError();
		}

		const productCount = await this.categoryRepository.countProducts(
			context.companyId,
			input.categoryId,
		);

		if (productCount > 0) {
			throw new CategoryInUseError(productCount);
		}

		const result = await this.categoryRepository.delete(
			context.companyId,
			input.categoryId,
		);

		switch (result) {
			case "deleted":
				return;
			case "not_found":
				throw new CategoryNotFoundError();
			case "in_use": {
				// The count above saw nothing, so a product started pointing at the
				// category in between. Re-count so the 409 reports what is true now;
				// the rejected foreign key already proved there is at least one.
				const current = await this.categoryRepository.countProducts(
					context.companyId,
					input.categoryId,
				);

				throw new CategoryInUseError(Math.max(current, 1));
			}
		}
	}
}
