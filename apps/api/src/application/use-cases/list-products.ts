import type { Product } from "../../domain/entities/product.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";

export interface ListProductsInput {
	/** Free text matched against the name or the SKU. */
	search?: string;
}

export interface ListProductsContext {
	/** The company whose catalogue is being read. */
	companyId: string;
}

export interface ListProductsDependencies {
	productRepository: ProductRepository;
}

/**
 * Use case for listing a company's catalogue (MI-7, MI-21, PROD-04).
 *
 * Reading needs **no role**: the company context already proved an ACTIVE
 * membership, and the catalogue belongs to that company (S6). The scoping is
 * the `companyId` in the query, not a filter here, so a caller can only ever
 * see the products of a company they belong to.
 *
 * The search is the one PROD-04 asks for today: name or SKU, substring,
 * case-insensitive. Filtering by category is out of scope until categories
 * exist (S5/L4).
 */
export class ListProductsUseCase {
	private readonly productRepository: ProductRepository;

	constructor(dependencies: ListProductsDependencies) {
		this.productRepository = dependencies.productRepository;
	}

	async execute(
		input: ListProductsInput,
		context: ListProductsContext,
	): Promise<Product[]> {
		// A whitespace-only search is "no search", not "match the empty string":
		// the client clearing the box must not hide the catalogue.
		const search = input.search?.trim();

		return this.productRepository.list(
			context.companyId,
			search === undefined || search.length === 0 ? undefined : search,
		);
	}
}
