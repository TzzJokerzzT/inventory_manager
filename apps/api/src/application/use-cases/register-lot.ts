import type { MembershipRole } from "../../domain/entities/membership.js";
import { StockLot } from "../../domain/entities/stock-lot.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import { SupplierNotFoundError } from "../../domain/errors/supplier-not-found-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";
import type { StockLotRepository } from "../../domain/repositories/stock-lot-repository.js";
import type { SupplierRepository } from "../../domain/repositories/supplier-repository.js";

export interface RegisterLotInput {
	productId: string;
	supplierId: string;
	/** Decimal string with the product price's rule; must be greater than 0. */
	costPerMeasure: string;
	/** One measure per physical unit, in the product's unit. */
	measures: number[];
	/** Absent means "the lot arrived now" (server clock). */
	receivedAt?: Date;
	note?: string | null;
}

export interface RegisterLotContext {
	/** The company the lot belongs to, from the resolved company context. */
	companyId: string;
	actorRole: MembershipRole;
	/** The caller from the token: the `IN` movement records who received it. */
	actorId: string;
}

export interface RegisterLotDependencies {
	productRepository: ProductRepository;
	supplierRepository: SupplierRepository;
	stockLotRepository: StockLotRepository;
}

/**
 * Use case for registering a purchase lot (S3, S6, S8).
 *
 * The order of the rules is part of the contract:
 *
 * 1. **`manage_products` first** -- a purchase is a catalogue write (OWNER and
 *    ADMIN write, MEMBER reads), and a MEMBER must never learn whether a body
 *    would have been valid, nor whether a product or a supplier id exists.
 * 2. **The product must be active in this company.** `findActiveById` filters
 *    by `companyId` and `deletedAt: null`, so a foreign, deleted or absent
 *    product answers the same {@link ProductNotFoundError} and the endpoint
 *    cannot be used to probe other companies' product ids.
 * 3. **The supplier must be active in this company** -- an inactive (soft
 *    deleted) or foreign supplier is the same {@link SupplierNotFoundError} a
 *    missing one produces. Last, so a request naming two bad ids cannot be used
 *    to learn which one was found first.
 * 4. **The body is validated by the entity**, not here: the derived
 *    `measureTotal`, the per-unit costs and the rounding are rules of
 *    `StockLot` (L7), so the adapter and the controller stay free of arithmetic.
 * 5. **The lot, its units, the `IN` movement and the stock increment are one
 *    atomic write** in the repository (L7), so a rejected request persists
 *    nothing.
 *
 * Both reads happen **before** the write, so a 404 never leaves a row behind.
 */
export class RegisterLotUseCase {
	private readonly productRepository: ProductRepository;
	private readonly supplierRepository: SupplierRepository;
	private readonly stockLotRepository: StockLotRepository;

	constructor(dependencies: RegisterLotDependencies) {
		this.productRepository = dependencies.productRepository;
		this.supplierRepository = dependencies.supplierRepository;
		this.stockLotRepository = dependencies.stockLotRepository;
	}

	async execute(
		input: RegisterLotInput,
		context: RegisterLotContext,
	): Promise<StockLot> {
		if (!can(context.actorRole, "manage_products")) {
			throw new InsufficientRoleError();
		}

		const product = await this.productRepository.findActiveById(
			context.companyId,
			input.productId,
		);

		if (product === null) {
			throw new ProductNotFoundError();
		}

		const supplier = await this.supplierRepository.findById(
			context.companyId,
			input.supplierId,
		);

		if (supplier === null) {
			throw new SupplierNotFoundError();
		}

		const lot = StockLot.create({
			companyId: context.companyId,
			productId: product.id,
			supplierId: supplier.id,
			costPerMeasure: input.costPerMeasure,
			measures: input.measures,
			receivedAt: input.receivedAt,
			note: input.note,
		});

		return this.stockLotRepository.register(lot, context.actorId);
	}
}
