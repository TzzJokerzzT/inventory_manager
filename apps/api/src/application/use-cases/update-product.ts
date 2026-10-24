import type { MeasureUnit } from "../../domain/entities/measure-unit.js";
import type { MembershipRole } from "../../domain/entities/membership.js";
import type { Product } from "../../domain/entities/product.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import { SkuAlreadyExistsError } from "../../domain/errors/sku-already-exists-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";

export interface UpdateProductInput {
	productId: string;
	/** Absent means "unchanged"; an explicit `null` clears the field. */
	name?: string;
	description?: string | null;
	sku?: string;
	price?: string;
	photoUrl?: string | null;
	/** Absent means "unchanged": the product keeps the unit it stores. */
	measureUnit?: MeasureUnit;
}

export interface UpdateProductContext {
	companyId: string;
	actorRole: MembershipRole;
}

export interface UpdateProductDependencies {
	productRepository: ProductRepository;
}

/**
 * Use case for the partial update of a product (S8, MI-25).
 *
 * The update is **partial**: an absent field is `undefined` and keeps its
 * value, while an explicit `null` clears `description` or `photoUrl`. That is
 * why the merge uses `undefined` checks and not `??`: `null` is a value here,
 * not a missing one.
 *
 * The order mirrors the create case: role first (S6), then the product must
 * exist in this company and be active (S3/S4), then the merged state is
 * re-validated by the entity, then the SKU uniqueness re-checked -- keeping the
 * product's own SKU is not a conflict (S2) -- and only then does the guarded
 * write happen.
 *
 * `stockQuantity` and `lowStockThreshold` are carried by the entity, so an
 * update can never move the stock: only the movements of MI-8 do (S1/L4).
 */
export class UpdateProductUseCase {
	private readonly productRepository: ProductRepository;

	constructor(dependencies: UpdateProductDependencies) {
		this.productRepository = dependencies.productRepository;
	}

	async execute(
		input: UpdateProductInput,
		context: UpdateProductContext,
	): Promise<Product> {
		if (!can(context.actorRole, "manage_products")) {
			throw new InsufficientRoleError();
		}

		const current = await this.productRepository.findActiveById(
			context.companyId,
			input.productId,
		);

		if (current === null) {
			throw new ProductNotFoundError();
		}

		const updated = current.withChanges({
			name: input.name,
			description: input.description,
			sku: input.sku,
			price: input.price,
			photoUrl: input.photoUrl,
			measureUnit: input.measureUnit,
		});

		const skuOwner = await this.productRepository.findBySku(
			context.companyId,
			updated.sku,
		);

		if (skuOwner !== null && skuOwner.id !== updated.id) {
			throw new SkuAlreadyExistsError();
		}

		const stored = await this.productRepository.update(updated);

		// Fail-closed: the guarded write refuses when the row was soft-deleted
		// between the read and the write, so a delete racing this update is not
		// reported as a successful update.
		if (stored === null) {
			throw new ProductNotFoundError();
		}

		return stored;
	}
}
