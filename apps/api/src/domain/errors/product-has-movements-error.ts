/**
 * Raised when a permanent delete is asked for a product that still has stock
 * movements.
 *
 * The ledger is the audit trail of the stock (MOV-05) and is never deleted, so
 * a product with history cannot be purged: S6 of odd/tasks/product-purge.md
 * leaves that case to a manual DBA operation. The count is carried so the
 * message explains the block instead of just rejecting it, and the same error
 * answers the race the database rejects with a foreign-key violation (L4).
 */
export const PRODUCT_HAS_MOVEMENTS_CODE = "product_has_movements";

export function productHasMovementsMessage(movementCount: number): string {
	const noun = movementCount === 1 ? "movement" : "movements";

	return `Product has ${movementCount} stock ${noun} and cannot be deleted permanently`;
}

export class ProductHasMovementsError extends Error {
	readonly movementCount: number;

	constructor(movementCount: number) {
		super(productHasMovementsMessage(movementCount));
		this.name = "ProductHasMovementsError";
		this.movementCount = movementCount;
	}
}
