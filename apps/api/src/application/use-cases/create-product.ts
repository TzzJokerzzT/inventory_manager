import type { MembershipRole } from "../../domain/entities/membership.js";
import { Product } from "../../domain/entities/product.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { SkuAlreadyExistsError } from "../../domain/errors/sku-already-exists-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";

export interface CreateProductInput {
	name: string;
	sku: string;
	/** Decimal string; the entity normalizes it to two decimals. */
	price: string;
	description?: string | null;
	photoUrl?: string | null;
}

export interface CreateProductContext {
	companyId: string;
	actorRole: MembershipRole;
}

export interface CreateProductDependencies {
	productRepository: ProductRepository;
}

/**
 * Use case for creating a product (MI-7, PROD-01).
 *
 * The order of the rules is part of the contract:
 *
 * 1. **`manage_products` first** (S6: OWNER and ADMIN write, MEMBER reads).
 *    A MEMBER must never learn whether a body is valid, so the role is checked
 *    before the entity validates anything.
 * 2. **The body is validated by the entity**, not here: one place decides what
 *    a valid product is, so a value that reaches the adapter is already
 *    normalized (trimmed name, uppercase SKU, two-decimal price).
 * 3. **The SKU must be free in this company, deleted rows included** (S2/L7).
 *    This read is the readable 409; the unique index is the authority for two
 *    concurrent creates, which is why the adapter translates `P2002` too.
 *
 * Only the fields of this input are accepted: `stockQuantity` and
 * `lowStockThreshold` are server-owned (MI-8, MI-12) and `categoryId` has no
 * feature yet (L4), so an unknown body key never reaches the entity.
 */
export class CreateProductUseCase {
	private readonly productRepository: ProductRepository;

	constructor(dependencies: CreateProductDependencies) {
		this.productRepository = dependencies.productRepository;
	}

	async execute(
		input: CreateProductInput,
		context: CreateProductContext,
	): Promise<Product> {
		if (!can(context.actorRole, "manage_products")) {
			throw new InsufficientRoleError();
		}

		const product = Product.create({
			companyId: context.companyId,
			name: input.name,
			sku: input.sku,
			price: input.price,
			description: input.description,
			photoUrl: input.photoUrl,
		});

		const existing = await this.productRepository.findBySku(
			context.companyId,
			product.sku,
		);

		if (existing !== null) {
			throw new SkuAlreadyExistsError();
		}

		return this.productRepository.create(product);
	}
}
