import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import type { CategoryRepository } from "../../domain/repositories/category-repository.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";
import type { StockLotRepository } from "../../domain/repositories/stock-lot-repository.js";
import type { SupplierRepository } from "../../domain/repositories/supplier-repository.js";
import type { ProductLotView } from "./product-view.js";
import {
	categoryNamesOf,
	type ProductDetailView,
	toProductDetailView,
	toProductLotView,
} from "./product-view.js";

/**
 * How many lots the product detail shows (L12: "los últimos 50"). It lives
 * next to the read that applies it so the contract and the query agree.
 */
export const PRODUCT_LOTS_LIMIT = 50;

export interface GetProductInput {
	productId: string;
}

export interface GetProductContext {
	/** The company whose catalogue is being read. */
	companyId: string;
}

export interface GetProductDependencies {
	productRepository: ProductRepository;
	stockLotRepository: StockLotRepository;
	supplierRepository: SupplierRepository;
	categoryRepository: CategoryRepository;
}

/**
 * Use case for reading one product (S8).
 *
 * A product of another company, a soft-deleted one and a nonexistent one all
 * answer the same {@link ProductNotFoundError}: the lookup filters by
 * `companyId` and `deletedAt: null`, so the endpoint cannot be used to probe
 * other companies' product ids (S4).
 *
 * The answer is the product **plus what its lots say** (L12): the cost per
 * measure and per unit derived from the units still available, and the latest
 * lots with the supplier of each. That is the comparison "which supplier
 * should I buy from", answered by the server because it is money.
 *
 * The read is five queries -- the product, the sums of its available units,
 * its latest lots, one batch of their suppliers and one batch with the
 * product's category -- never one per lot. The category is resolved by the API
 * (S5/S7), so the client never joins a cached catalogue to name it.
 *
 * Reading needs no role: the company context already proved an ACTIVE
 * membership.
 */
export class GetProductUseCase {
	private readonly productRepository: ProductRepository;
	private readonly stockLotRepository: StockLotRepository;
	private readonly supplierRepository: SupplierRepository;
	private readonly categoryRepository: CategoryRepository;

	constructor(dependencies: GetProductDependencies) {
		this.productRepository = dependencies.productRepository;
		this.stockLotRepository = dependencies.stockLotRepository;
		this.supplierRepository = dependencies.supplierRepository;
		this.categoryRepository = dependencies.categoryRepository;
	}

	async execute(
		input: GetProductInput,
		context: GetProductContext,
	): Promise<ProductDetailView> {
		const product = await this.productRepository.findActiveById(
			context.companyId,
			input.productId,
		);

		if (product === null) {
			throw new ProductNotFoundError();
		}

		const totals = await this.stockLotRepository.findAvailableUnitTotals(
			context.companyId,
			[product.id],
		);
		const lots = await this.stockLotRepository.findLatestByProduct(
			context.companyId,
			product.id,
			PRODUCT_LOTS_LIMIT,
		);

		// Deduplicated: the same supplier usually sold several of the lots, and
		// each one must cost one lookup, not one query.
		const supplierIds = [...new Set(lots.map((lot) => lot.supplierId))];
		const suppliers =
			supplierIds.length === 0
				? []
				: await this.supplierRepository.findByIds(
						context.companyId,
						supplierIds,
					);
		const suppliersById = new Map(
			suppliers.map((supplier) => [supplier.id, supplier]),
		);

		const lotViews: ProductLotView[] = lots.map((lot) => {
			const supplier = suppliersById.get(lot.supplierId);

			// The lot's supplier is a foreign key, and a soft-deleted supplier is
			// still resolved by `findByIds`, so a missing one is an inconsistent
			// store -- reported, never papered over with an invented name.
			if (supplier === undefined) {
				throw new Error(
					`Stock lot ${lot.id} points at supplier ${lot.supplierId}, which does not exist`,
				);
			}

			return toProductLotView(lot, supplier.name);
		});

		return toProductDetailView(
			product,
			totals.get(product.id) ?? null,
			await this.findCategoryNames(context.companyId, product.categoryId),
			lotViews,
		);
	}

	/**
	 * Resolves the name of the product's category with the same batch read the
	 * list uses, or no lookup at all when the product has no category (S7).
	 */
	private async findCategoryNames(
		companyId: string,
		categoryId: string | null,
	): Promise<Map<string, string>> {
		if (categoryId === null) {
			return new Map();
		}

		const categories = await this.categoryRepository.findByIds(companyId, [
			categoryId,
		]);

		return categoryNamesOf(categories);
	}
}
