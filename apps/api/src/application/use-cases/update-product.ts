import type { MeasureUnit } from "../../domain/entities/measure-unit.js";
import type { MembershipRole } from "../../domain/entities/membership.js";
import { CategoryNotFoundError } from "../../domain/errors/category-not-found-error.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { ProductNotFoundError } from "../../domain/errors/product-not-found-error.js";
import { SkuAlreadyExistsError } from "../../domain/errors/sku-already-exists-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { CategoryRepository } from "../../domain/repositories/category-repository.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";
import type { ProductFields } from "./product-view.js";
import { toProductFields } from "./product-view.js";

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
	/** Absent means "unchanged": an explicit `0` is a value, not a missing one. */
	lowStockThreshold?: number;
	/**
	 * Absent means "unchanged": the product keeps its category. An explicit
	 * `null` clears it and a given id has to belong to the company (S7).
	 */
	categoryId?: string | null;
}

export interface UpdateProductContext {
	companyId: string;
	actorRole: MembershipRole;
}

export interface UpdateProductDependencies {
	productRepository: ProductRepository;
	categoryRepository: CategoryRepository;
}

/**
 * Use case for the partial update of a product (S8, MI-25).
 *
 * The update is **partial**: an absent field is `undefined` and keeps its
 * value, while an explicit `null` clears `description`, `photoUrl` or
 * `categoryId`. That is why the merge uses `undefined` checks and not `??`:
 * `null` is a value here, not a missing one.
 *
 * The order mirrors the create case: role first (S6), then the product must
 * exist in this company and be active (S3/S4), then the category the change
 * names must exist in this same company (S7: a foreign or unknown one is a
 * {@link CategoryNotFoundError} and nothing is written), then the merged state
 * is re-validated by the entity, then the SKU uniqueness re-checked -- keeping
 * the product's own SKU is not a conflict (S2) -- and only then does the
 * guarded write happen.
 *
 * `stockQuantity` is carried by the entity, so an update can never move the
 * stock: only the movements of MI-8 do (S1/L4). `lowStockThreshold` is
 * writable (S2/NOTIF-01): absent keeps the stored value and `0` is a value.
 */
export class UpdateProductUseCase {
	private readonly productRepository: ProductRepository;
	private readonly categoryRepository: CategoryRepository;

	constructor(dependencies: UpdateProductDependencies) {
		this.productRepository = dependencies.productRepository;
		this.categoryRepository = dependencies.categoryRepository;
	}

	async execute(
		input: UpdateProductInput,
		context: UpdateProductContext,
	): Promise<ProductFields> {
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

		// Resolved before the write: a category of another company or one that
		// does not exist answers the same 404 and leaves the row untouched (S7).
		const categoryName = await this.resolveCategoryName(
			context.companyId,
			current.categoryId,
			input.categoryId,
		);

		const updated = current.withChanges({
			name: input.name,
			description: input.description,
			sku: input.sku,
			price: input.price,
			photoUrl: input.photoUrl,
			measureUnit: input.measureUnit,
			lowStockThreshold: input.lowStockThreshold,
			categoryId: input.categoryId,
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

		return toProductFields(stored, categoryName);
	}

	/**
	 * Resolves the name of the category the product will point at after the
	 * change: the stored one when the body does not name a category, `null` when
	 * it clears it, and the named category's name otherwise.
	 *
	 * A named category that does not resolve inside the company is the 404 S7
	 * asks for; it is checked before the write, so a rejected request changes
	 * nothing.
	 */
	private async resolveCategoryName(
		companyId: string,
		currentCategoryId: string | null,
		requestedCategoryId: string | null | undefined,
	): Promise<string | null> {
		if (requestedCategoryId === null) {
			return null;
		}

		const categoryId = requestedCategoryId ?? currentCategoryId;

		if (categoryId === null) {
			return null;
		}

		const category = await this.categoryRepository.findById(
			companyId,
			categoryId,
		);

		if (category === null) {
			throw new CategoryNotFoundError();
		}

		return category.name;
	}
}
