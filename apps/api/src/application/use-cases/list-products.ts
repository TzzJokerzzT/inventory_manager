import type { ProductRepository } from "../../domain/repositories/product-repository.js";
import type { StockLotRepository } from "../../domain/repositories/stock-lot-repository.js";
import type { ProductListView } from "./product-view.js";
import { toProductListView } from "./product-view.js";

export interface ListProductsInput {
	/** Free text matched against the name or the SKU. */
	search?: string;
	/**
	 * `true` reads the trash (only the soft-deleted products) instead of the
	 * active catalogue. Absent or `false` keeps listing the active products,
	 * which is what every existing client gets (S4/L3).
	 */
	deleted?: boolean;
}

export interface ListProductsContext {
	/** The company whose catalogue is being read. */
	companyId: string;
}

export interface ListProductsDependencies {
	productRepository: ProductRepository;
	stockLotRepository: StockLotRepository;
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
 *
 * `deleted` swaps the half of the store that is read -- the trash instead of
 * the active catalogue -- and changes nothing else: the search and the order
 * are the same in both (S4).
 *
 * Each row carries the cost figures derived from its available units (L12),
 * resolved in **one** batch read for the whole page instead of one per product.
 * The list has no lots: those belong to the detail, where the comparison is
 * made, and loading 50 lots per catalogue row would be a different feature.
 */
export class ListProductsUseCase {
	private readonly productRepository: ProductRepository;
	private readonly stockLotRepository: StockLotRepository;

	constructor(dependencies: ListProductsDependencies) {
		this.productRepository = dependencies.productRepository;
		this.stockLotRepository = dependencies.stockLotRepository;
	}

	async execute(
		input: ListProductsInput,
		context: ListProductsContext,
	): Promise<ProductListView[]> {
		// A whitespace-only search is "no search", not "match the empty string":
		// the client clearing the box must not hide the catalogue.
		const search = input.search?.trim();

		const products = await this.productRepository.list(context.companyId, {
			search: search === undefined || search.length === 0 ? undefined : search,
			deleted: input.deleted === true,
		});

		if (products.length === 0) {
			return [];
		}

		const totals = await this.stockLotRepository.findAvailableUnitTotals(
			context.companyId,
			products.map((product) => product.id),
		);

		return products.map((product) =>
			toProductListView(product, totals.get(product.id) ?? null),
		);
	}
}
