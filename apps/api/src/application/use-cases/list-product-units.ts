import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";
import type {
	ProductUnitStatusFilter,
	StockLotRepository,
} from "../../domain/repositories/stock-lot-repository.js";
import type { ProductUnitView } from "./product-view.js";
import { toProductUnitView } from "./product-view.js";

/**
 * The status a read asks for when the client sends none (L23).
 *
 * A sale offers what is still in stock, so `AVAILABLE` is the default; the other
 * two exist for the history (what was sold, and the whole ledger of units).
 */
export const DEFAULT_PRODUCT_UNIT_STATUS: ProductUnitStatusFilter = "AVAILABLE";

export interface ListProductUnitsInput {
	productId: string;
	/** Absent means {@link DEFAULT_PRODUCT_UNIT_STATUS}. */
	status?: ProductUnitStatusFilter;
}

export interface ListProductUnitsContext {
	/** The company whose catalogue is being read. */
	companyId: string;
}

export interface ListProductUnitsDependencies {
	productRepository: ProductRepository;
	stockLotRepository: StockLotRepository;
}

/**
 * Use case for reading the concrete units of a product (L23).
 *
 * F3 needs to know **which** units leave, not only how many are left: the sale
 * screen lists them with their measure and their own cost, and the client sends
 * the chosen ids back. This read is the source of that list.
 *
 * The product is resolved first, with the same `findActiveById` the rest of the
 * catalogue reads use: a product of another company, a soft-deleted one and a
 * nonexistent one all answer the same {@link ProductNotFoundError}, so the
 * endpoint cannot be used to probe other companies' product ids. A product that
 * exists but never came in a lot answers an empty array -- "no units" is not
 * "no product".
 *
 * Reading needs **no role**: the company context already proved an ACTIVE
 * membership, which is exactly the rule of the other product reads (L23).
 *
 * The order the answer comes in -- oldest lot first, then code -- belongs to the
 * port, so both adapters offer the same sale-first ordering.
 */
export class ListProductUnitsUseCase {
	private readonly productRepository: ProductRepository;
	private readonly stockLotRepository: StockLotRepository;

	constructor(dependencies: ListProductUnitsDependencies) {
		this.productRepository = dependencies.productRepository;
		this.stockLotRepository = dependencies.stockLotRepository;
	}

	async execute(
		input: ListProductUnitsInput,
		context: ListProductUnitsContext,
	): Promise<ProductUnitView[]> {
		const product = await this.productRepository.findActiveById(
			context.companyId,
			input.productId,
		);

		if (product === null) {
			throw new ProductNotFoundError();
		}

		const units = await this.stockLotRepository.findUnitsByProduct(
			context.companyId,
			product.id,
			input.status ?? DEFAULT_PRODUCT_UNIT_STATUS,
		);

		return units.map((unit) => toProductUnitView(unit));
	}
}
