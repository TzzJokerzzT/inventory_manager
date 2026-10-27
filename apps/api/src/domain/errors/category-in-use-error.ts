/**
 * Raised when the hard delete of a category is asked for while products of the
 * company still reference it.
 *
 * `Product.categoryId` is `RESTRICT` for every row -- soft-deleted products
 * included -- so the row cannot be removed without losing which category those
 * products belong to. The count is carried so the message explains the block
 * instead of just rejecting it (the same shape `ProductHasMovementsError` uses),
 * and the same error answers the race the database rejects with a foreign-key
 * violation (P2003), which the adapter reports as `in_use`.
 */
export const CATEGORY_IN_USE_CODE = "category_in_use";

export function categoryInUseMessage(productCount: number): string {
	const noun = productCount === 1 ? "product" : "products";

	return `Category is in use by ${productCount} ${noun} and cannot be deleted`;
}

export class CategoryInUseError extends Error {
	readonly productCount: number;

	constructor(productCount: number) {
		super(categoryInUseMessage(productCount));
		this.name = "CategoryInUseError";
		this.productCount = productCount;
	}
}
