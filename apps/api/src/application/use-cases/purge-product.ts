import type { MembershipRole } from "../../domain/entities/membership.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { ProductHasMovementsError } from "../../domain/errors/product-has-movements-error.js";
import { ProductNotDeletedError } from "../../domain/errors/product-not-deleted-error.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";
import type { StockMovementRepository } from "../../domain/repositories/stock-movement-repository.js";

export interface PurgeProductInput {
	productId: string;
}

export interface PurgeProductContext {
	companyId: string;
	actorRole: MembershipRole;
}

export interface PurgeProductDependencies {
	productRepository: ProductRepository;
	stockMovementRepository: StockMovementRepository;
}

/**
 * Use case for the permanent delete of a product (odd/tasks/product-purge.md
 * S2-S4).
 *
 * It is the second half of the trash: a soft-deleted product can be restored
 * or purged. The rules, in order, are the contract:
 *
 * 1. **`purge_products` first** (S3/L2). It is a separate action of the matrix,
 *    not a flag of `manage_products`, because the row is removed for good:
 *    only the OWNER may purge, and an ADMIN stops here without learning
 *    anything about the id.
 * 2. **The count comes before the delete** (L4). A product with movements
 *    answers `409 product_has_movements` carrying the count, and the delete is
 *    never attempted; the ledger is the audit trail (MOV-05) and is never
 *    touched.
 * 3. **The delete is the guarded write**: `purge` only matches a soft-deleted
 *    row of the company, so an active product is `409 product_not_deleted`
 *    (L3), and a foreign or absent one is the same `404 product_not_found`.
 * 4. **The race has the same answer as the count** (S4). A movement can land
 *    between the count and the `DELETE`; the database rejects the row and the
 *    adapter reports `has_movements`, which this use case maps to the same
 *    409 -- never a 500.
 */
export class PurgeProductUseCase {
	private readonly productRepository: ProductRepository;
	private readonly stockMovementRepository: StockMovementRepository;

	constructor(dependencies: PurgeProductDependencies) {
		this.productRepository = dependencies.productRepository;
		this.stockMovementRepository = dependencies.stockMovementRepository;
	}

	async execute(
		input: PurgeProductInput,
		context: PurgeProductContext,
	): Promise<void> {
		if (!can(context.actorRole, "purge_products")) {
			throw new InsufficientRoleError();
		}

		const movementCount = await this.stockMovementRepository.countByProduct(
			context.companyId,
			input.productId,
		);

		if (movementCount > 0) {
			throw new ProductHasMovementsError(movementCount);
		}

		const result = await this.productRepository.purge(
			context.companyId,
			input.productId,
		);

		switch (result) {
			case "purged":
				return;
			case "not_found":
				throw new ProductNotFoundError();
			case "not_deleted":
				throw new ProductNotDeletedError();
			case "has_movements": {
				// The count above saw nothing, so a movement landed in between.
				// Re-count so the 409 reports what is true now; the rejected
				// foreign key already proved there is at least one.
				const current = await this.stockMovementRepository.countByProduct(
					context.companyId,
					input.productId,
				);

				throw new ProductHasMovementsError(Math.max(current, 1));
			}
		}
	}
}
