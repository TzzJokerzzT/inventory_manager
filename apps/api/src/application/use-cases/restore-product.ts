import type { MembershipRole } from "../../domain/entities/membership.js";
import type { Product } from "../../domain/entities/product.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { ProductNotDeletedError } from "../../domain/errors/product-not-deleted-error.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";

export interface RestoreProductInput {
	productId: string;
}

export interface RestoreProductContext {
	companyId: string;
	actorRole: MembershipRole;
}

export interface RestoreProductDependencies {
	productRepository: ProductRepository;
}

/**
 * Use case for bringing a soft-deleted product back (S2, S3).
 *
 * It is the answer to "the SKU is taken by the product I deleted": the row was
 * never removed, so restoring reuses it -- id, SKU and movement history
 * included -- instead of creating a copy.
 *
 * The order of the rules is part of the contract:
 *
 * 1. **`manage_products` first** (L4: the same permission as the soft delete),
 *    so a MEMBER never learns whether the id exists.
 * 2. **The read includes the soft-deleted rows** (`findByIds` is the history
 *    read), so the product in the trash resolves. Missing or foreign -> the
 *    same 404 as everywhere else.
 * 3. **An active product is a conflict**, not a no-op (L2): the trash is a
 *    state, not a flag.
 * 4. **`restore` is the guarded write.** It only clears `deletedAt` while the
 *    row is still deleted, so of two concurrent restores exactly one wins. The
 *    loser gets `null` and re-reads: 404 if the row is gone, 409 if somebody
 *    else already restored it.
 */
export class RestoreProductUseCase {
	private readonly productRepository: ProductRepository;

	constructor(dependencies: RestoreProductDependencies) {
		this.productRepository = dependencies.productRepository;
	}

	async execute(
		input: RestoreProductInput,
		context: RestoreProductContext,
	): Promise<Product> {
		if (!can(context.actorRole, "manage_products")) {
			throw new InsufficientRoleError();
		}

		const [product] = await this.productRepository.findByIds(
			context.companyId,
			[input.productId],
		);

		if (product === undefined) {
			throw new ProductNotFoundError();
		}

		if (product.deletedAt === null) {
			throw new ProductNotDeletedError();
		}

		const restored = await this.productRepository.restore(
			context.companyId,
			input.productId,
		);

		if (restored !== null) {
			return restored;
		}

		// The write matched no row: somebody else changed the state between the
		// read above and the write. Re-read once and report what is true now.
		const [current] = await this.productRepository.findByIds(
			context.companyId,
			[input.productId],
		);

		if (current !== undefined && current.deletedAt === null) {
			throw new ProductNotDeletedError();
		}

		throw new ProductNotFoundError();
	}
}
