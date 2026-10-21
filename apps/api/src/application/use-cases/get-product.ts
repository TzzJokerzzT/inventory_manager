import type { Product } from "../../domain/entities/product.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";

export interface GetProductInput {
	productId: string;
}

export interface GetProductContext {
	/** The company whose catalogue is being read. */
	companyId: string;
}

export interface GetProductDependencies {
	productRepository: ProductRepository;
}

/**
 * Use case for reading one product (S8).
 *
 * A product of another company, a soft-deleted one and a nonexistent one all
 * answer the same {@link ProductNotFoundError}: the lookup filters by
 * `companyId` and `deletedAt: null`, so the endpoint cannot be used to probe
 * other companies' product ids (S4).
 *
 * Reading needs no role: the company context already proved an ACTIVE
 * membership.
 */
export class GetProductUseCase {
	private readonly productRepository: ProductRepository;

	constructor(dependencies: GetProductDependencies) {
		this.productRepository = dependencies.productRepository;
	}

	async execute(
		input: GetProductInput,
		context: GetProductContext,
	): Promise<Product> {
		const product = await this.productRepository.findActiveById(
			context.companyId,
			input.productId,
		);

		if (product === null) {
			throw new ProductNotFoundError();
		}

		return product;
	}
}
