import type {
	StockMovement,
	StockMovementType,
} from "../../domain/entities/stock-movement.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";
import type { StockMovementRepository } from "../../domain/repositories/stock-movement-repository.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";

/**
 * The contract's default page size. It lives next to the use case that applies
 * it, so the HTTP validator and the read agree on one number.
 */
export const DEFAULT_STOCK_MOVEMENT_LIMIT = 50;

/** The product a movement refers to, as the history shows it. */
export interface MovementProduct {
	id: string;
	name: string;
	sku: string;
}

/** Who registered a movement, or `null` when the user row was not resolved. */
export interface StockMovementActor {
	id: string;
	fullName: string | null;
	email: string;
}

/**
 * One movement as the caller sees it: the stored fields plus the product and
 * the actor resolved by the API. `actor` is `null` when the user could not be
 * resolved -- a missing actor never hides the movement, the same rule the
 * notification read applies.
 */
export interface StockMovementView {
	id: string;
	companyId: string;
	productId: string;
	type: StockMovementType;
	quantity: number;
	reason: string | null;
	createdAt: string;
	product: MovementProduct;
	actor: StockMovementActor | null;
}

/**
 * Builds the view from the entity and its resolved context. Shared by the
 * register and the list use cases so the two responses cannot drift apart.
 *
 * The fields are picked explicitly instead of spreading `movement.toJSON()`:
 * the contract's `StockMovement` carries the actor as `actor`, never a bare
 * `userId`, and a spread would leak the raw column to the HTTP body.
 */
export function toStockMovementView(
	movement: StockMovement,
	product: MovementProduct,
	actor: StockMovementActor | null,
): StockMovementView {
	return {
		id: movement.id,
		companyId: movement.companyId,
		productId: movement.productId,
		type: movement.type,
		quantity: movement.quantity,
		reason: movement.reason,
		createdAt: movement.createdAt.toISOString(),
		product: { id: product.id, name: product.name, sku: product.sku },
		actor:
			actor === null
				? null
				: { id: actor.id, fullName: actor.fullName, email: actor.email },
	};
}

export interface ListStockMovementsInput {
	/** Only the movements of this product (MOV-03). */
	productId?: string;
	/** Only entries (`IN`) or only exits (`OUT`). */
	type?: StockMovementType;
	/** Page size, newest first; defaults to {@link DEFAULT_STOCK_MOVEMENT_LIMIT}. */
	limit?: number;
}

export interface ListStockMovementsContext {
	/** The company whose history is being read. */
	companyId: string;
}

export interface ListStockMovementsDependencies {
	stockMovementRepository: StockMovementRepository;
	productRepository: ProductRepository;
	userRepository: UserRepository;
}

/**
 * Use case for reading the stock history (MOV-03, MOV-05).
 *
 * Reading needs **no role**: the company context already proved an ACTIVE
 * membership, and the history belongs to that company (S6). The scoping is the
 * `companyId` in the query, not a filter here.
 *
 * The whole read is three queries: the movements, one deduplicated batch of
 * products and one deduplicated batch of users. Joining the context per row
 * would be N+1, so the context is resolved once and joined in memory.
 *
 * The product is resolved with `findByIds`, which includes the soft-deleted
 * rows: a movement of a product that was later deleted stays readable
 * (MOV-05). A movement that resolves no product means the store is
 * inconsistent -- the rows are never hard-deleted -- so this fails as an
 * unexpected error (a 500) instead of inventing a product.
 */
export class ListStockMovementsUseCase {
	private readonly stockMovementRepository: StockMovementRepository;
	private readonly productRepository: ProductRepository;
	private readonly userRepository: UserRepository;

	constructor(dependencies: ListStockMovementsDependencies) {
		this.stockMovementRepository = dependencies.stockMovementRepository;
		this.productRepository = dependencies.productRepository;
		this.userRepository = dependencies.userRepository;
	}

	async execute(
		input: ListStockMovementsInput,
		context: ListStockMovementsContext,
	): Promise<StockMovementView[]> {
		const movements = await this.stockMovementRepository.findByCompany(
			context.companyId,
			{
				productId: input.productId,
				type: input.type,
				limit: input.limit ?? DEFAULT_STOCK_MOVEMENT_LIMIT,
			},
		);

		if (movements.length === 0) {
			return [];
		}

		// Deduplicated before each batch read: several movements of the same
		// product must cost one lookup, not one per movement.
		const productIds = [
			...new Set(movements.map((movement) => movement.productId)),
		];
		const products = await this.productRepository.findByIds(
			context.companyId,
			productIds,
		);
		const productsById = new Map(
			products.map((product) => [product.id, product]),
		);

		const actorIds = [...new Set(movements.map((movement) => movement.userId))];
		const actors = await this.userRepository.findByIds(actorIds);
		const actorsById = new Map(actors.map((actor) => [actor.id, actor]));

		return movements.map((movement) => {
			const product = productsById.get(movement.productId);

			if (product === undefined) {
				throw new Error(
					`Stock movement ${movement.id} points at product ${movement.productId}, which does not exist`,
				);
			}

			return toStockMovementView(
				movement,
				product,
				actorsById.get(movement.userId) ?? null,
			);
		});
	}
}
