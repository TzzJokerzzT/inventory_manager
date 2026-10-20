import type { MembershipRole } from "../../domain/entities/membership.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";

export interface DeleteProductInput {
	productId: string;
}

export interface DeleteProductContext {
	companyId: string;
	actorRole: MembershipRole;
}

export interface DeleteProductDependencies {
	productRepository: ProductRepository;
}

/**
 * Use case for the soft delete of a product (PROD-03, S3).
 *
 * The row is never removed: `deletedAt` is stamped so the stock movements of
 * MI-8 keep pointing at a readable product, and its SKU stays reserved (L7).
 * The endpoint answers `204`, so nothing is returned.
 *
 * A second `DELETE`, a product of another company and a nonexistent one all
 * answer the same {@link ProductNotFoundError}: the resource already left the
 * catalogue, and which of the three it was is not the caller's business (S4).
 */
export class DeleteProductUseCase {
	private readonly productRepository: ProductRepository;

	constructor(dependencies: DeleteProductDependencies) {
		this.productRepository = dependencies.productRepository;
	}

	async execute(
		input: DeleteProductInput,
		context: DeleteProductContext,
	): Promise<void> {
		// The role is checked before the write, so a MEMBER never reaches the
		// catalogue at all (S6).
		if (!can(context.actorRole, "manage_products")) {
			throw new InsufficientRoleError();
		}

		const deleted = await this.productRepository.softDelete(
			context.companyId,
			input.productId,
		);

		if (deleted === null) {
			throw new ProductNotFoundError();
		}
	}
}
