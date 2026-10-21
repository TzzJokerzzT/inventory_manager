import type { StockMovementType } from "../../domain/entities/stock-movement.js";
import { StockMovement } from "../../domain/entities/stock-movement.js";
import { InsufficientStockError } from "../../domain/errors/insufficient-stock-error.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";
import type { StockMovementRepository } from "../../domain/repositories/stock-movement-repository.js";
import type {
	StockMovementActor,
	StockMovementView,
} from "./list-stock-movements.js";
import { toStockMovementView } from "./list-stock-movements.js";

export interface RegisterStockMovementInput {
	productId: string;
	/** `IN` adds `quantity`, `OUT` subtracts it (S1/S2). */
	type: StockMovementType;
	/** Always positive; the entity validates the `1..1_000_000` range. */
	quantity: number;
	reason?: string | null;
}

export interface RegisterStockMovementContext {
	/** The company the movement belongs to, from the resolved company context. */
	companyId: string;
	/** The caller from the token; `userId` is never read from the body. */
	actor: StockMovementActor;
}

export interface RegisterStockMovementDependencies {
	productRepository: ProductRepository;
	stockMovementRepository: StockMovementRepository;
}

export interface RegisterStockMovementResult {
	movement: StockMovementView;
	/** The product's stock **after** the movement. */
	stockQuantity: number;
}

/**
 * Use case for registering a stock movement (MOV-01, MOV-02, MOV-04, MOV-05).
 *
 * The rules, in order:
 *
 * 1. **The product must be active in this company.** `findActiveById` filters
 *    by `companyId` and `deletedAt: null`, so a missing, deleted or foreign
 *    product answers the same {@link ProductNotFoundError}, and the endpoint
 *    cannot be used to probe other companies' product ids.
 * 2. **The body is validated by the entity**, not here, and `userId`/
 *    `createdAt` are server-owned: the movement is built with the caller from
 *    the token and the clock of the server, so a movement cannot be attributed
 *    to someone else nor backdated.
 * 3. **The stock change and the insert are one atomic write** in the
 *    repository. Its union carries the two expected outcomes, which this use
 *    case maps to their domain errors; `insufficient_stock` keeps the
 *    available amount so the client can explain it.
 *
 * There is **no role check**: any ACTIVE membership registers movements (S6,
 * L2). The company context is the guard, so no `can()` row is added for this.
 */
export class RegisterStockMovementUseCase {
	private readonly productRepository: ProductRepository;
	private readonly stockMovementRepository: StockMovementRepository;

	constructor(dependencies: RegisterStockMovementDependencies) {
		this.productRepository = dependencies.productRepository;
		this.stockMovementRepository = dependencies.stockMovementRepository;
	}

	async execute(
		input: RegisterStockMovementInput,
		context: RegisterStockMovementContext,
	): Promise<RegisterStockMovementResult> {
		const product = await this.productRepository.findActiveById(
			context.companyId,
			input.productId,
		);

		if (product === null) {
			throw new ProductNotFoundError();
		}

		const movement = StockMovement.create({
			companyId: context.companyId,
			productId: product.id,
			type: input.type,
			quantity: input.quantity,
			reason: input.reason,
			userId: context.actor.id,
		});

		const result = await this.stockMovementRepository.register(movement);

		switch (result.kind) {
			case "product_not_found":
				// The product was readable a moment ago; between the two reads it
				// was deleted or moved to another company. Same 404, no leak.
				throw new ProductNotFoundError();
			case "insufficient_stock":
				throw new InsufficientStockError(result.available);
			case "registered":
				return {
					movement: toStockMovementView(
						result.movement,
						product,
						context.actor,
					),
					stockQuantity: result.stockQuantity,
				};
		}
	}
}
