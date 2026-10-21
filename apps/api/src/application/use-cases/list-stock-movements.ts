import type {
	StockMovement,
	StockMovementType,
} from "../../domain/entities/stock-movement.js";
import type { CustomerRepository } from "../../domain/repositories/customer-repository.js";
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

/** The customer a sale is associated with, as the history shows it. */
export interface MovementCustomer {
	id: string;
	name: string;
}

/** Who registered a movement, or `null` when the user row was not resolved. */
export interface StockMovementActor {
	id: string;
	fullName: string | null;
	email: string;
}

/**
 * One movement as the caller sees it: the stored fields plus the product, the
 * actor and the customer resolved by the API. `actor` is `null` when the user
 * could not be resolved -- a missing actor never hides the movement, the same
 * rule the notification read applies. `customer` is `null` only when the
 * movement carries no `customerId`.
 */
export interface StockMovementView {
	id: string;
	companyId: string;
	productId: string;
	type: StockMovementType;
	quantity: number;
	reason: string | null;
	createdAt: string;
	customerId: string | null;
	customer: MovementCustomer | null;
	product: MovementProduct;
	actor: StockMovementActor | null;
}

/**
 * Builds the view from the entity and its resolved context. Shared by the
 * register and the list use cases so the two responses cannot drift apart.
 *
 * The fields are picked explicitly instead of spreading `movement.toJSON()`:
 * the contract's `StockMovement` carries the actor as `actor`, never a bare
 * `userId`, and the customer as a resolved `customer` object, so a spread
 * would leak the raw columns to the HTTP body.
 */
export function toStockMovementView(
	movement: StockMovement,
	product: MovementProduct,
	actor: StockMovementActor | null,
	customer: MovementCustomer | null,
): StockMovementView {
	return {
		id: movement.id,
		companyId: movement.companyId,
		productId: movement.productId,
		type: movement.type,
		quantity: movement.quantity,
		reason: movement.reason,
		createdAt: movement.createdAt.toISOString(),
		customerId: movement.customerId,
		customer:
			customer === null ? null : { id: customer.id, name: customer.name },
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
	/**
	 * Only the movements associated with this customer. It combines with the
	 * other filters and, unlike a resource read, an id that does not belong to
	 * the company answers no rows instead of an error.
	 */
	customerId?: string;
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
	customerRepository: CustomerRepository;
}

/**
 * Use case for reading the stock history (MOV-03, MOV-05).
 *
 * Reading needs **no role**: the company context already proved an ACTIVE
 * membership, and the history belongs to that company (S6). The scoping is the
 * `companyId` in the query, not a filter here.
 *
 * The whole read is four queries: the movements, one deduplicated batch of
 * products, one deduplicated batch of users and one deduplicated batch of
 * customers. Joining the context per row would be N+1, so the context is
 * resolved once and joined in memory.
 *
 * The product and the customer are resolved with `findByIds`, which includes
 * the soft-deleted rows: a movement of a product or of a customer that was
 * later deleted stays readable (MOV-05). A movement that resolves no product,
 * or that names a customer the store cannot resolve, means the store is
 * inconsistent -- the rows are never hard-deleted -- so this fails as an
 * unexpected error (a 500) instead of inventing a row.
 */
export class ListStockMovementsUseCase {
	private readonly stockMovementRepository: StockMovementRepository;
	private readonly productRepository: ProductRepository;
	private readonly userRepository: UserRepository;
	private readonly customerRepository: CustomerRepository;

	constructor(dependencies: ListStockMovementsDependencies) {
		this.stockMovementRepository = dependencies.stockMovementRepository;
		this.productRepository = dependencies.productRepository;
		this.userRepository = dependencies.userRepository;
		this.customerRepository = dependencies.customerRepository;
	}

	async execute(
		input: ListStockMovementsInput,
		context: ListStockMovementsContext,
	): Promise<StockMovementView[]> {
		const movements = await this.stockMovementRepository.findByCompany(
			context.companyId,
			{
				productId: input.productId,
				customerId: input.customerId,
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

		// Only the movements that carry a customer need the lookup: an anonymous
		// movement (or an entry) costs nothing here.
		const customerIds = [
			...new Set(
				movements.flatMap((movement) =>
					movement.customerId === null ? [] : [movement.customerId],
				),
			),
		];
		const customers =
			customerIds.length === 0
				? []
				: await this.customerRepository.findByIds(
						context.companyId,
						customerIds,
					);
		const customersById = new Map(
			customers.map((customer) => [customer.id, customer]),
		);

		return movements.map((movement) => {
			const product = productsById.get(movement.productId);

			if (product === undefined) {
				throw new Error(
					`Stock movement ${movement.id} points at product ${movement.productId}, which does not exist`,
				);
			}

			const customer =
				movement.customerId === null
					? null
					: customersById.get(movement.customerId);

			if (customer === undefined) {
				throw new Error(
					`Stock movement ${movement.id} points at customer ${movement.customerId}, which does not exist`,
				);
			}

			return toStockMovementView(
				movement,
				product,
				actorsById.get(movement.userId) ?? null,
				customer,
			);
		});
	}
}
