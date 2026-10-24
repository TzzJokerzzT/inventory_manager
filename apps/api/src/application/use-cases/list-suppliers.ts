import type { MeasureUnit } from "../../domain/entities/measure-unit.js";
import type { Supplier } from "../../domain/entities/supplier.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";
import type {
	StockLotRepository,
	SupplierLatestLot,
} from "../../domain/repositories/stock-lot-repository.js";
import type { SupplierRepository } from "../../domain/repositories/supplier-repository.js";

/** The most recent purchase of a supplier, as the roster shows it (L12). */
export interface SupplierLastLotView {
	id: string;
	productId: string;
	productName: string;
	/** `Decimal(12,2)` string: what one measure of that lot cost. */
	costPerMeasure: string;
	/** The measure unit of the product bought (`KILOGRAM`, `LITRE`, `METRE`). */
	measureUnit: MeasureUnit;
	receivedAt: string;
}

/**
 * A supplier as the list shows it: the stored fields plus its latest lot, or
 * `null` for a supplier the company never bought from.
 *
 * The lot is the summary the roster needs -- "who sells me this product and at
 * what price per measure" -- and it is derived from the lots, never stored on
 * the supplier.
 */
export interface SupplierListView {
	id: string;
	companyId: string;
	name: string;
	contact: string | null;
	createdAt: string;
	updatedAt: string;
	lastLot: SupplierLastLotView | null;
}

export interface ListSuppliersContext {
	/** The company whose suppliers are being read. */
	companyId: string;
}

export interface ListSuppliersDependencies {
	supplierRepository: SupplierRepository;
	stockLotRepository: StockLotRepository;
	productRepository: ProductRepository;
}

/**
 * Use case for listing a company's suppliers (S4).
 *
 * Reading needs **no role**: the company context already proved an ACTIVE
 * membership, and `manage_products` only discriminates on writes (OWNER and
 * ADMIN write, MEMBER reads). The scoping is the `companyId` in the query, not
 * a filter here, so a caller can only ever see the suppliers of a company they
 * belong to.
 *
 * Each row carries its supplier's latest lot (L12), resolved in one batch
 * read for the whole roster plus one batch of the products those lots bought:
 * the price per measure of the last purchase is the roster's summary of "who
 * sells me this". A supplier with no lot of the company answers `lastLot:
 * null` -- never a fabricated row.
 *
 * Ordering (`name`, then `id`) belongs to the adapter, so both adapters answer
 * the same array for the same state.
 */
export class ListSuppliersUseCase {
	private readonly supplierRepository: SupplierRepository;
	private readonly stockLotRepository: StockLotRepository;
	private readonly productRepository: ProductRepository;

	constructor(dependencies: ListSuppliersDependencies) {
		this.supplierRepository = dependencies.supplierRepository;
		this.stockLotRepository = dependencies.stockLotRepository;
		this.productRepository = dependencies.productRepository;
	}

	async execute(context: ListSuppliersContext): Promise<SupplierListView[]> {
		const suppliers = await this.supplierRepository.listByCompany(
			context.companyId,
		);

		if (suppliers.length === 0) {
			return [];
		}

		const latestLots = await this.stockLotRepository.findLatestBySupplier(
			context.companyId,
			suppliers.map((supplier) => supplier.id),
		);

		// Deduplicated: several suppliers may have sold the same product, and the
		// name and measure unit of it must cost one lookup.
		const productIds = [
			...new Set([...latestLots.values()].map((lot) => lot.productId)),
		];
		const products =
			productIds.length === 0
				? []
				: await this.productRepository.findByIds(context.companyId, productIds);
		const productsById = new Map(
			products.map((product) => [product.id, product]),
		);

		return suppliers.map((supplier) =>
			toSupplierListView(supplier, latestLots.get(supplier.id), productsById),
		);
	}
}

/** Builds the roster row, resolving its latest lot's product (L12). */
function toSupplierListView(
	supplier: Supplier,
	lot: SupplierLatestLot | undefined,
	productsById: Map<string, { name: string; measureUnit: MeasureUnit }>,
): SupplierListView {
	if (lot === undefined) {
		return { ...supplier.toJSON(), lastLot: null };
	}

	const product = productsById.get(lot.productId);

	// The lot's product is a foreign key and `findByIds` resolves the
	// soft-deleted ones too, so a missing product is an inconsistent store --
	// reported, never hidden behind an invented name.
	if (product === undefined) {
		throw new Error(
			`Stock lot ${lot.id} points at product ${lot.productId}, which does not exist`,
		);
	}

	return {
		...supplier.toJSON(),
		lastLot: {
			id: lot.id,
			productId: lot.productId,
			productName: product.name,
			costPerMeasure: lot.costPerMeasure,
			measureUnit: product.measureUnit,
			receivedAt: lot.receivedAt.toISOString(),
		},
	};
}
