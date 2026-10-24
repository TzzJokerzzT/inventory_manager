import type {
	AvailableUnitTotals,
	ProductCosts,
} from "../../domain/costing/derived-costs.js";
import { deriveProductCosts } from "../../domain/costing/derived-costs.js";
import type { MeasureUnit } from "../../domain/entities/measure-unit.js";
import type { Product } from "../../domain/entities/product.js";
import type { ProductLotSummary } from "../../domain/repositories/stock-lot-repository.js";

/**
 * The product fields every product response carries, spelled out instead of
 * derived from `Product.toJSON` at the type level: this is what the contract
 * says, and `deletedAt` is deliberately absent because a soft-deleted product
 * is never returned.
 */
export interface ProductFields {
	id: string;
	companyId: string;
	name: string;
	description: string | null;
	sku: string;
	price: string;
	photoUrl: string | null;
	stockQuantity: number;
	lowStockThreshold: number;
	/**
	 * The unit `costPerMeasure` is expressed in (L19). Part of every product
	 * response, writes included, so a client can render "$ per kg" without
	 * asking a second endpoint.
	 */
	measureUnit: MeasureUnit;
	categoryId: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * A product as the list shows it: the stored fields plus the cost figures
 * derived from its available units (L12).
 *
 * The costs are part of the **reads**, not of the product row: a write answers
 * the entity it stored, and deriving costs for a product nobody has bought yet
 * would be four nulls on every create. That is why the create/update/restore
 * responses keep the plain `Product` contract.
 */
export interface ProductListView extends ProductFields, ProductCosts {}

/** One lot of the product, as the "which supplier should I buy from" view shows it. */
export interface ProductLotView {
	id: string;
	supplierId: string;
	supplierName: string;
	receivedAt: string;
	measureTotal: string;
	costPerMeasure: string;
	unitCount: number;
	availableUnits: number;
}

/**
 * The detail of one product: the list row plus its latest lots (L12). The lots
 * are the purchase history the comparison needs -- the same product bought at
 * two prices from two suppliers, newest first.
 */
export interface ProductDetailView extends ProductListView {
	lots: ProductLotView[];
}

/**
 * Builds the product read from the entity and the sums of its available units.
 *
 * The derived fields come from {@link deriveProductCosts}, the one place that
 * owns that arithmetic, so the list and the detail cannot disagree on a cost.
 */
export function toProductListView(
	product: Product,
	totals: AvailableUnitTotals | null | undefined,
): ProductListView {
	return {
		...product.toJSON(),
		...deriveProductCosts(product.price, totals),
	};
}

/**
 * Builds the detail by attaching the resolved lots to a product read.
 *
 * The lots arrive already resolved (their supplier has a name), because
 * resolving them needs the supplier store and belongs to the use case.
 */
export function toProductDetailView(
	product: Product,
	totals: AvailableUnitTotals | null | undefined,
	lots: ProductLotView[],
): ProductDetailView {
	return { ...toProductListView(product, totals), lots };
}

/** Maps the stored lot plus its supplier name to the view. */
export function toProductLotView(
	lot: ProductLotSummary,
	supplierName: string,
): ProductLotView {
	return {
		id: lot.id,
		supplierId: lot.supplierId,
		supplierName,
		receivedAt: lot.receivedAt.toISOString(),
		measureTotal: lot.measureTotal,
		costPerMeasure: lot.costPerMeasure,
		unitCount: lot.unitCount,
		availableUnits: lot.availableUnits,
	};
}
