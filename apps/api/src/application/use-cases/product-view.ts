import type {
	AvailableUnitTotals,
	ProductCosts,
} from "../../domain/costing/derived-costs.js";
import { deriveProductCosts } from "../../domain/costing/derived-costs.js";
import type { Category } from "../../domain/entities/category.js";
import type { LotUnitStatus } from "../../domain/entities/lot-unit.js";
import type { MeasureUnit } from "../../domain/entities/measure-unit.js";
import type { Product } from "../../domain/entities/product.js";
import type {
	ProductLotSummary,
	ProductUnitSummary,
} from "../../domain/repositories/stock-lot-repository.js";

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
	/**
	 * The name of the category the product belongs to, resolved by the API
	 * (S5/S7): `null` means the product has no category, and a client renders it
	 * without joining a catalogue it only has cached.
	 */
	categoryName: string | null;
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
 * Builds the product read from the entity, the sums of its available units and
 * the category names resolved by the use case.
 *
 * The derived fields come from {@link deriveProductCosts}, the one place that
 * owns that arithmetic, so the list and the detail cannot disagree on a cost.
 * The names arrive as one map for the whole page, built from a single batch
 * read through the category port (S7), and the resolution happens here so the
 * list and the detail cannot disagree on a name either.
 */
export function toProductListView(
	product: Product,
	totals: AvailableUnitTotals | null | undefined,
	categoryNames: ReadonlyMap<string, string>,
): ProductListView {
	return {
		...product.toJSON(),
		categoryName: resolveCategoryName(product, categoryNames),
		...deriveProductCosts(product.price, totals),
	};
}

/**
 * Builds the plain product response a write answers: the stored entity plus the
 * name of its category.
 *
 * The writes answer the fields every product response carries, not the costs of
 * the reads: deriving them for a product nobody has bought yet would be four
 * nulls on every create.
 */
export function toProductFields(
	product: Product,
	categoryName: string | null,
): ProductFields {
	return { ...product.toJSON(), categoryName };
}

/**
 * Builds the `id -> name` lookup of a batch of categories, so the join happens
 * once per read instead of once per row.
 */
export function categoryNamesOf(
	categories: readonly Category[],
): Map<string, string> {
	return new Map(categories.map((category) => [category.id, category.name]));
}

/**
 * Resolves the name of the product's category from the batch lookup, or `null`
 * when the product has none.
 *
 * A product that points at a category the batch did not answer means the store
 * is inconsistent -- the foreign key is `RESTRICT`, so the row cannot vanish
 * while a product references it -- and that is reported instead of papered over
 * with an invented name.
 */
export function resolveCategoryName(
	product: Product,
	categoryNames: ReadonlyMap<string, string>,
): string | null {
	if (product.categoryId === null) {
		return null;
	}

	const name = categoryNames.get(product.categoryId);

	if (name === undefined) {
		throw new Error(
			`Product ${product.id} points at category ${product.categoryId}, which does not exist`,
		);
	}

	return name;
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
	categoryNames: ReadonlyMap<string, string>,
	lots: ProductLotView[],
): ProductDetailView {
	return { ...toProductListView(product, totals, categoryNames), lots };
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

/**
 * One physical unit of a product, as `GET .../products/{productId}/units`
 * answers it (L23).
 *
 * It is the unit plus the lot it came in, because the sale screen shows the
 * concrete unit and offers the oldest stock first: `receivedAt` is the lot's
 * date and `lotId` lets the client group the units of one purchase. There is no
 * `companyId` nor `productId`: the answer is always inside the product and the
 * company of the path.
 */
export interface ProductUnitView {
	id: string;
	code: string;
	measure: string;
	cost: string;
	status: LotUnitStatus;
	lotId: string;
	receivedAt: string;
}

/**
 * Maps a unit read to the contract's shape.
 *
 * `measure` and `cost` are the stored normalized decimals, so the client gets
 * exactly the columns' precision (`"2.000"`, `"2000.00"`) instead of a float
 * the server would have had to build first.
 */
export function toProductUnitView(unit: ProductUnitSummary): ProductUnitView {
	return {
		id: unit.id,
		code: unit.code,
		measure: unit.measure,
		cost: unit.cost,
		status: unit.status,
		lotId: unit.lotId,
		receivedAt: unit.receivedAt.toISOString(),
	};
}
