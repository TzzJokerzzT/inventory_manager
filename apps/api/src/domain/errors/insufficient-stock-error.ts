/**
 * Raised when an exit (`OUT`) asks for more stock than the product has.
 *
 * The guard is the *write* itself (`stockQuantity >= quantity` in the update),
 * so this error is the readable outcome of a guarded write that matched no row
 * while the product was still there -- the case of two concurrent exits where
 * the loser re-reads the stock. The available amount is carried so the caller
 * can explain it without a second read.
 */
export const INSUFFICIENT_STOCK_CODE = "insufficient_stock";

export function insufficientStockMessage(available: number): string {
	return `Insufficient stock: ${available} available`;
}

export class InsufficientStockError extends Error {
	readonly available: number;

	constructor(available: number) {
		super(insufficientStockMessage(available));
		this.name = "InsufficientStockError";
		this.available = available;
	}
}
