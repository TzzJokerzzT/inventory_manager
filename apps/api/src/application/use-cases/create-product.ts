import type { MeasureUnit } from "../../domain/entities/measure-unit.js";
import type { MembershipRole } from "../../domain/entities/membership.js";
import { Product } from "../../domain/entities/product.js";
import { CategoryNotFoundError } from "../../domain/errors/category-not-found-error.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { SkuAlreadyExistsError } from "../../domain/errors/sku-already-exists-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { CategoryRepository } from "../../domain/repositories/category-repository.js";
import type { ProductRepository } from "../../domain/repositories/product-repository.js";
import type { ProductFields } from "./product-view.js";
import { toProductFields } from "./product-view.js";

export interface CreateProductInput {
	name: string;
	sku: string;
	/** Decimal string; the entity normalizes it to two decimals. */
	price: string;
	description?: string | null;
	photoUrl?: string | null;
	/**
	 * How the lots of this product are measured (L19). Absent means the
	 * column's default, which the entity applies.
	 */
	measureUnit?: MeasureUnit;
	/**
	 * The number the dashboard compares against (S2/NOTIF-01). Absent means the
	 * column's default (`0`), which the entity applies.
	 */
	lowStockThreshold?: number;
	/**
	 * The category of the new product (S7). Absent means "no category", and a
	 * given id has to belong to the company.
	 */
	categoryId?: string | null;
}

export interface CreateProductContext {
	companyId: string;
	actorRole: MembershipRole;
}

export interface CreateProductDependencies {
	productRepository: ProductRepository;
	categoryRepository: CategoryRepository;
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
 * 3. **The category must exist in this company** (S7). A category of another
 *    company and a nonexistent one answer the same
 *    {@link CategoryNotFoundError} -- a 404 -- so the endpoint cannot be used
 *    to probe another company's category ids, and nothing is written.
 * 4. **The SKU must be free in this company, deleted rows included** (S2/L7).
 *    This read is the readable 409; the unique index is the authority for two
 *    concurrent creates, which is why the adapter translates `P2002` too.
 *
 * Only the fields of this input are accepted: `stockQuantity` is server-owned
 * (MI-8), so an unknown body key never reaches the entity. `lowStockThreshold`
 * is writable since NOTIF-01 (S2) and `categoryId` since S7.
 */
export class CreateProductUseCase {
	private readonly productRepository: ProductRepository;
	private readonly categoryRepository: CategoryRepository;

	constructor(dependencies: CreateProductDependencies) {
		this.productRepository = dependencies.productRepository;
		this.categoryRepository = dependencies.categoryRepository;
	}

	async execute(
		input: CreateProductInput,
		context: CreateProductContext,
	): Promise<ProductFields> {
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
			measureUnit: input.measureUnit,
			lowStockThreshold: input.lowStockThreshold,
			categoryId: input.categoryId,
		});

		// Read before the write, so a foreign or unknown category is a 404 and
		// not a row that references nothing.
		const categoryName = await this.findCategoryName(
			context.companyId,
			product.categoryId,
		);

		const existing = await this.productRepository.findBySku(
			context.companyId,
			product.sku,
		);

		if (existing !== null) {
			throw new SkuAlreadyExistsError();
		}

		const stored = await this.productRepository.create(product);

		return toProductFields(stored, categoryName);
	}

	/**
	 * Resolves the name of the category the product will point at, or `null`
	 * when it has none. A category that does not resolve inside the company is
	 * the 404 S7 asks for.
	 */
	private async findCategoryName(
		companyId: string,
		categoryId: string | null,
	): Promise<string | null> {
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
