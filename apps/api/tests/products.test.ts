import { CreateProductUseCase } from "../src/application/use-cases/create-product.js";
import { DeleteProductUseCase } from "../src/application/use-cases/delete-product.js";
import { GetProductUseCase } from "../src/application/use-cases/get-product.js";
import { ListProductsUseCase } from "../src/application/use-cases/list-products.js";
import { PurgeProductUseCase } from "../src/application/use-cases/purge-product.js";
import { RestoreProductUseCase } from "../src/application/use-cases/restore-product.js";
import { UpdateProductUseCase } from "../src/application/use-cases/update-product.js";
import type { MembershipRole } from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { StockMovement } from "../src/domain/entities/stock-movement.js";
import { DomainError } from "../src/domain/errors/domain-error.js";
import { InsufficientRoleError } from "../src/domain/errors/insufficient-role-error.js";
import { ProductHasMovementsError } from "../src/domain/errors/product-has-movements-error.js";
import { ProductNotDeletedError } from "../src/domain/errors/product-not-deleted-error.js";
import { ProductNotFoundError } from "../src/domain/errors/product-not-found-error.js";
import { SkuAlreadyExistsError } from "../src/domain/errors/sku-already-exists-error.js";
import type { ProductRepository } from "../src/domain/repositories/product-repository.js";
import type { StockMovementRepository } from "../src/domain/repositories/stock-movement-repository.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockLotRepository } from "../src/infrastructure/database/in-memory-stock-lot-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";
import { InMemorySupplierRepository } from "../src/infrastructure/database/in-memory-supplier-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";

interface SeedInput {
	id: string;
	companyId?: string;
	name?: string;
	sku?: string;
	price?: string;
	description?: string | null;
	photoUrl?: string | null;
	stockQuantity?: number;
	deleted?: boolean;
}

function seed(
	repository: InMemoryProductRepository,
	input: SeedInput,
): Product {
	const product = Product.create({
		id: input.id,
		companyId: input.companyId ?? COMPANY,
		name: input.name ?? `Product ${input.id}`,
		sku: input.sku ?? `SKU-${input.id}`,
		price: input.price ?? "1500",
		description: input.description ?? null,
		photoUrl: input.photoUrl ?? null,
		stockQuantity: input.stockQuantity ?? 0,
		deletedAt: input.deleted ? new Date("2026-10-22T12:00:00.000Z") : null,
	});

	repository.save(product);

	return product;
}

function repository(): InMemoryProductRepository {
	return new InMemoryProductRepository();
}

function context(actorRole: MembershipRole = "OWNER") {
	return { companyId: COMPANY, actorRole };
}

describe("CreateProductUseCase", () => {
	function createProduct(repository_: InMemoryProductRepository) {
		return new CreateProductUseCase({ productRepository: repository_ });
	}

	it("creates the product as an OWNER", async () => {
		const created = await createProduct(repository()).execute(
			{
				name: "  Cafe molido 500g  ",
				sku: "  caf-500 ",
				price: "1500",
				description: " Molido medio ",
			},
			context("OWNER"),
		);

		expect(created).toMatchObject({
			companyId: COMPANY,
			name: "Cafe molido 500g",
			sku: "CAF-500",
			price: "1500.00",
			description: "Molido medio",
		});
	});

	it("creates the product as an ADMIN", async () => {
		await expect(
			createProduct(repository()).execute(
				{ name: "Cafe", sku: "CAF-500", price: "1" },
				context("ADMIN"),
			),
		).resolves.toMatchObject({ sku: "CAF-500", price: "1.00" });
	});

	it("persists it in the repository", async () => {
		const repository_ = repository();

		const created = await createProduct(repository_).execute(
			{ name: "Cafe", sku: "CAF-500", price: "1500" },
			context("OWNER"),
		);

		await expect(repository_.findActiveById(COMPANY, created.id)).resolves.toBe(
			created,
		);
	});

	it("never accepts stock, the low-stock threshold or a category from the body", async () => {
		// S1/L4: stock is moved by the stock movements of MI-8, the threshold
		// belongs to NOTIF-01, and categories have no feature yet.
		const created = await createProduct(repository()).execute(
			{
				name: "Cafe",
				sku: "CAF-500",
				price: "1500",
				stockQuantity: 99,
				lowStockThreshold: 5,
				categoryId: "category-1",
			} as never,
			context("OWNER"),
		);

		expect(created.stockQuantity).toBe(0);
		expect(created.lowStockThreshold).toBe(0);
		expect(created.categoryId).toBeNull();
	});

	it("rejects a MEMBER with InsufficientRoleError, before validating anything", async () => {
		// S6: "OWNER y ADMIN escriben; MEMBER solo lee". An invalid body must not
		// be what a MEMBER hears: the role check comes first.
		await expect(
			createProduct(repository()).execute(
				{ name: "", sku: "", price: "nope" },
				context("MEMBER"),
			),
		).rejects.toThrow(InsufficientRoleError);
	});

	it("answers SkuAlreadyExistsError for a sku another product of the company has", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", sku: "CAF-500" });

		await expect(
			createProduct(repository_).execute(
				{ name: "Otro cafe", sku: " caf-500 ", price: "1500" },
				context("OWNER"),
			),
		).rejects.toThrow(SkuAlreadyExistsError);
	});

	it("keeps a soft-deleted product's sku reserved", async () => {
		// S2/L7: the unique index covers deleted rows, so deleting a product
		// reserves its SKU.
		const repository_ = repository();
		seed(repository_, { id: "product-1", sku: "CAF-500", deleted: true });

		await expect(
			createProduct(repository_).execute(
				{ name: "Cafe", sku: "CAF-500", price: "1500" },
				context("OWNER"),
			),
		).rejects.toThrow(SkuAlreadyExistsError);
	});

	it("lets two companies use the same sku", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "product-1",
			companyId: OTHER_COMPANY,
			sku: "CAF-500",
		});

		await expect(
			createProduct(repository_).execute(
				{ name: "Cafe", sku: "CAF-500", price: "1500" },
				context("OWNER"),
			),
		).resolves.toMatchObject({ companyId: COMPANY });
	});

	it("rejects an invalid price with a domain error", async () => {
		await expect(
			createProduct(repository()).execute(
				{ name: "Cafe", sku: "CAF-500", price: "7.505" },
				context("OWNER"),
			),
		).rejects.toThrow(DomainError);
	});
});

describe("ListProductsUseCase", () => {
	function listProducts(repository_: InMemoryProductRepository) {
		return new ListProductsUseCase({
			productRepository: repository_,
			stockLotRepository: new InMemoryStockLotRepository(
				new InMemoryStockMovementRepository(new Map()),
			),
		});
	}

	it("lists the company's active products ordered by name, as a MEMBER may do", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-2", name: "Zapallo" });
		seed(repository_, { id: "product-1", name: "Cafe" });

		const listed = await listProducts(repository_).execute(
			{},
			{ companyId: COMPANY },
		);

		expect(listed.map((row) => row.name)).toEqual(["Cafe", "Zapallo"]);
	});

	it("searches by name, case-insensitively", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", name: "Cafe molido 500g" });
		seed(repository_, { id: "product-2", name: "Azucar" });

		const listed = await listProducts(repository_).execute(
			{ search: "  CAFE " },
			{ companyId: COMPANY },
		);

		expect(listed.map((row) => row.id)).toEqual(["product-1"]);
	});

	it("searches by sku, case-insensitively", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", name: "Cafe", sku: "CAF-500" });
		seed(repository_, { id: "product-2", name: "Azucar", sku: "SUGAR-1" });

		const listed = await listProducts(repository_).execute(
			{ search: "caf-5" },
			{ companyId: COMPANY },
		);

		expect(listed.map((row) => row.id)).toEqual(["product-1"]);
	});

	it("treats an empty search as no filter", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1" });
		seed(repository_, { id: "product-2" });

		const listed = await listProducts(repository_).execute(
			{ search: "   " },
			{ companyId: COMPANY },
		);

		expect(listed).toHaveLength(2);
	});

	it("never lists a soft-deleted product nor another company's", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", deleted: true });
		seed(repository_, { id: "product-2", companyId: OTHER_COMPANY });

		await expect(
			listProducts(repository_).execute({}, { companyId: COMPANY }),
		).resolves.toEqual([]);
	});

	it("lists only the soft-deleted products when the trash is asked for", async () => {
		// S4/L3: `deleted: true` is the trash, not "actives plus deleted".
		const repository_ = repository();
		seed(repository_, { id: "product-1", name: "Cafe", deleted: true });
		seed(repository_, { id: "product-2", name: "Zapallo", deleted: true });
		seed(repository_, { id: "product-3", name: "Azucar" });

		const listed = await listProducts(repository_).execute(
			{ deleted: true },
			{ companyId: COMPANY },
		);

		// Same order as the active catalogue: name, then id.
		expect(listed.map((row) => row.id)).toEqual(["product-1", "product-2"]);
	});

	it("keeps the search when listing the trash", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "product-1",
			name: "Cafe molido",
			sku: "CAF-500",
			deleted: true,
		});
		seed(repository_, {
			id: "product-2",
			name: "Azucar",
			sku: "SUGAR-1",
			deleted: true,
		});
		seed(repository_, { id: "product-3", name: "Cafe", sku: "CAF-900" });

		const listed = await listProducts(repository_).execute(
			{ search: "cafe", deleted: true },
			{ companyId: COMPANY },
		);

		expect(listed.map((row) => row.id)).toEqual(["product-1"]);
	});

	it("keeps the trash empty when nothing was deleted", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1" });

		await expect(
			listProducts(repository_).execute(
				{ deleted: true },
				{ companyId: COMPANY },
			),
		).resolves.toEqual([]);
	});
});

describe("GetProductUseCase", () => {
	function getProduct(repository_: InMemoryProductRepository) {
		return new GetProductUseCase({
			productRepository: repository_,
			stockLotRepository: new InMemoryStockLotRepository(
				new InMemoryStockMovementRepository(new Map()),
			),
			supplierRepository: new InMemorySupplierRepository(),
		});
	}

	it("returns the product of the company with the costs of its available units", async () => {
		const repository_ = repository();
		const product = seed(repository_, { id: "product-1" });

		const read = await getProduct(repository_).execute(
			{ productId: "product-1" },
			{ companyId: COMPANY },
		);

		expect(read).toEqual({
			...product.toJSON(),
			availableUnits: 0,
			availableMeasure: "0.000",
			costPerMeasure: null,
			unitCost: null,
			marginPerUnit: null,
			lots: [],
		});
	});

	it("answers ProductNotFoundError for another company's product", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", companyId: OTHER_COMPANY });

		await expect(
			getProduct(repository_).execute(
				{ productId: "product-1" },
				{ companyId: COMPANY },
			),
		).rejects.toThrow(ProductNotFoundError);
	});

	it("answers ProductNotFoundError for a soft-deleted product", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", deleted: true });

		await expect(
			getProduct(repository_).execute(
				{ productId: "product-1" },
				{ companyId: COMPANY },
			),
		).rejects.toThrow(ProductNotFoundError);
	});

	it("answers ProductNotFoundError for a product that does not exist", async () => {
		await expect(
			getProduct(repository()).execute(
				{ productId: "product-nope" },
				{ companyId: COMPANY },
			),
		).rejects.toThrow(ProductNotFoundError);
	});
});

describe("UpdateProductUseCase", () => {
	function updateProduct(repository_: InMemoryProductRepository) {
		return new UpdateProductUseCase({ productRepository: repository_ });
	}

	it("updates the given fields and preserves the untouched ones", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "product-1",
			name: "Cafe molido",
			sku: "CAF-500",
			price: "1500",
			description: "Molido medio",
			photoUrl: "https://example.com/a.png",
			stockQuantity: 12,
		});

		const updated = await updateProduct(repository_).execute(
			{ productId: "product-1", name: "  Cafe en grano  ", price: "7.5" },
			context("OWNER"),
		);

		expect(updated).toMatchObject({
			id: "product-1",
			companyId: COMPANY,
			name: "Cafe en grano",
			price: "7.50",
			sku: "CAF-500",
			description: "Molido medio",
			photoUrl: "https://example.com/a.png",
		});
	});

	it("never touches the stock", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", stockQuantity: 12 });

		const updated = await updateProduct(repository_).execute(
			{ productId: "product-1", name: "Cafe en grano" },
			context("OWNER"),
		);

		expect(updated.stockQuantity).toBe(12);
	});

	it("clears description and photoUrl when null is sent explicitly", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "product-1",
			description: "Molido medio",
			photoUrl: "https://example.com/a.png",
		});

		const updated = await updateProduct(repository_).execute(
			{ productId: "product-1", description: null, photoUrl: null },
			context("OWNER"),
		);

		expect(updated.description).toBeNull();
		expect(updated.photoUrl).toBeNull();
	});

	it("normalizes an empty description to null", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", description: "Molido medio" });

		const updated = await updateProduct(repository_).execute(
			{ productId: "product-1", description: "   " },
			context("OWNER"),
		);

		expect(updated.description).toBeNull();
	});

	it("allows an ADMIN to update", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1" });

		await expect(
			updateProduct(repository_).execute(
				{ productId: "product-1", name: "Cafe en grano" },
				context("ADMIN"),
			),
		).resolves.toMatchObject({ name: "Cafe en grano" });
	});

	it("lets a product keep its own sku", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", sku: "CAF-500" });

		await expect(
			updateProduct(repository_).execute(
				{ productId: "product-1", sku: " caf-500 " },
				context("OWNER"),
			),
		).resolves.toMatchObject({ sku: "CAF-500" });
	});

	it("answers SkuAlreadyExistsError when the new sku belongs to another product", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", sku: "CAF-500" });
		seed(repository_, { id: "product-2", sku: "SUGAR-1" });

		await expect(
			updateProduct(repository_).execute(
				{ productId: "product-2", sku: "caf-500" },
				context("OWNER"),
			),
		).rejects.toThrow(SkuAlreadyExistsError);
	});

	it("rejects a MEMBER with InsufficientRoleError", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1" });

		await expect(
			updateProduct(repository_).execute(
				{ productId: "product-1", name: "Cafe en grano" },
				context("MEMBER"),
			),
		).rejects.toThrow(InsufficientRoleError);
	});

	it("answers ProductNotFoundError for a soft-deleted product", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", deleted: true });

		await expect(
			updateProduct(repository_).execute(
				{ productId: "product-1", name: "Cafe en grano" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductNotFoundError);
	});

	it("answers ProductNotFoundError for another company's product", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", companyId: OTHER_COMPANY });

		await expect(
			updateProduct(repository_).execute(
				{ productId: "product-1", name: "Cafe en grano" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductNotFoundError);
	});

	it("re-validates the patched fields", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1" });

		await expect(
			updateProduct(repository_).execute(
				{ productId: "product-1", price: "7.505" },
				context("OWNER"),
			),
		).rejects.toThrow(DomainError);
	});
});

describe("DeleteProductUseCase", () => {
	function deleteProduct(repository_: InMemoryProductRepository) {
		return new DeleteProductUseCase({ productRepository: repository_ });
	}

	it("soft-deletes the product, which then disappears from the catalogue", async () => {
		const repository_ = repository();
		const product = seed(repository_, { id: "product-1" });

		await expect(
			deleteProduct(repository_).execute(
				{ productId: "product-1" },
				context("OWNER"),
			),
		).resolves.toBeUndefined();

		await expect(
			repository_.findActiveById(COMPANY, "product-1"),
		).resolves.toBeNull();
		// The row survives: the stock movements must stay readable.
		await expect(
			repository_.findBySku(COMPANY, product.sku),
		).resolves.not.toBeNull();
	});

	it("lets an ADMIN delete", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1" });

		await expect(
			deleteProduct(repository_).execute(
				{ productId: "product-1" },
				context("ADMIN"),
			),
		).resolves.toBeUndefined();
	});

	it("answers ProductNotFoundError on a second delete", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1" });

		const useCase = deleteProduct(repository_);
		await useCase.execute({ productId: "product-1" }, context("OWNER"));

		await expect(
			useCase.execute({ productId: "product-1" }, context("OWNER")),
		).rejects.toThrow(ProductNotFoundError);
	});

	it("rejects a MEMBER with InsufficientRoleError", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1" });

		await expect(
			deleteProduct(repository_).execute(
				{ productId: "product-1" },
				context("MEMBER"),
			),
		).rejects.toThrow(InsufficientRoleError);
	});

	it("answers ProductNotFoundError for another company's product", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", companyId: OTHER_COMPANY });

		await expect(
			deleteProduct(repository_).execute(
				{ productId: "product-1" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductNotFoundError);
	});
});

/**
 * A repository whose two reads and whose guarded write are scripted by the
 * test, so the race the port describes can actually happen: the write matches
 * no row even though the read before it did.
 */
function racedRepository(reads: (Product | undefined)[]): ProductRepository {
	let call = 0;

	return {
		findByIds: async () => {
			const row = reads[Math.min(call, reads.length - 1)];
			call += 1;

			return row === undefined ? [] : [row];
		},
		restore: async () => null,
	} as unknown as ProductRepository;
}

describe("RestoreProductUseCase", () => {
	function restoreProduct(productRepository: ProductRepository) {
		return new RestoreProductUseCase({ productRepository });
	}

	it("brings the product back with its own id and sku", async () => {
		// S2: the SKU stayed reserved, so restoring reuses the row instead of
		// creating a copy.
		const repository_ = repository();
		seed(repository_, { id: "product-1", sku: "CAF-500", deleted: true });

		const restored = await restoreProduct(repository_).execute(
			{ productId: "product-1" },
			context("OWNER"),
		);

		expect(restored).toMatchObject({
			id: "product-1",
			companyId: COMPANY,
			sku: "CAF-500",
		});
		expect(restored.deletedAt).toBeNull();
		await expect(
			repository_.findActiveById(COMPANY, "product-1"),
		).resolves.toBe(restored);
	});

	it("leaves the stock and the history of the row untouched", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "product-1",
			stockQuantity: 12,
			description: "Molido medio",
			deleted: true,
		});

		const restored = await restoreProduct(repository_).execute(
			{ productId: "product-1" },
			context("OWNER"),
		);

		expect(restored.stockQuantity).toBe(12);
		expect(restored.description).toBe("Molido medio");
	});

	it("lets an ADMIN restore", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", deleted: true });

		await expect(
			restoreProduct(repository_).execute(
				{ productId: "product-1" },
				context("ADMIN"),
			),
		).resolves.toMatchObject({ id: "product-1" });
	});

	it("answers ProductNotDeletedError for a product that is not deleted", async () => {
		// L2: restoring is not an idempotent no-op; the client learns that the
		// state was not the one it thought.
		const repository_ = repository();
		seed(repository_, { id: "product-1" });

		await expect(
			restoreProduct(repository_).execute(
				{ productId: "product-1" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductNotDeletedError);
	});

	it("answers ProductNotDeletedError on a second restore", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", deleted: true });

		const useCase = restoreProduct(repository_);
		await useCase.execute({ productId: "product-1" }, context("OWNER"));

		await expect(
			useCase.execute({ productId: "product-1" }, context("OWNER")),
		).rejects.toThrow(ProductNotDeletedError);
	});

	it("answers ProductNotDeletedError when the guarded write loses the race and the row is already active", async () => {
		const deleted = Product.create({
			id: "product-1",
			companyId: COMPANY,
			name: "Cafe",
			sku: "CAF-500",
			price: "1500",
			deletedAt: new Date("2026-10-22T12:00:00.000Z"),
		});
		const active = Product.create({
			id: "product-1",
			companyId: COMPANY,
			name: "Cafe",
			sku: "CAF-500",
			price: "1500",
		});

		await expect(
			restoreProduct(racedRepository([deleted, active])).execute(
				{ productId: "product-1" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductNotDeletedError);
	});

	it("answers ProductNotFoundError when the guarded write loses the race and the row is gone", async () => {
		const deleted = Product.create({
			id: "product-1",
			companyId: COMPANY,
			name: "Cafe",
			sku: "CAF-500",
			price: "1500",
			deletedAt: new Date("2026-10-22T12:00:00.000Z"),
		});

		await expect(
			restoreProduct(racedRepository([deleted, undefined])).execute(
				{ productId: "product-1" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductNotFoundError);
	});

	it("answers ProductNotFoundError for another company's product", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "product-1",
			companyId: OTHER_COMPANY,
			deleted: true,
		});

		await expect(
			restoreProduct(repository_).execute(
				{ productId: "product-1" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductNotFoundError);
	});

	it("answers ProductNotFoundError for a product that does not exist", async () => {
		await expect(
			restoreProduct(repository()).execute(
				{ productId: "product-nope" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductNotFoundError);
	});

	it("rejects a MEMBER with InsufficientRoleError", async () => {
		// L4: restore shares the permission of the soft delete.
		const repository_ = repository();
		seed(repository_, { id: "product-1", deleted: true });

		await expect(
			restoreProduct(repository_).execute(
				{ productId: "product-1" },
				context("MEMBER"),
			),
		).rejects.toThrow(InsufficientRoleError);
	});
});

/**
 * A ledger whose count is scripted by the test. It lets the suite script the
 * race the port describes: the count sees nothing and the delete still loses
 * against a movement that landed in between.
 */
function scriptedMovementCounts(counts: number[]): StockMovementRepository {
	let call = 0;

	return {
		countByProduct: async () => {
			const value = counts[Math.min(call, counts.length - 1)];
			call += 1;

			return value;
		},
	} as unknown as StockMovementRepository;
}

/**
 * A product repository whose guarded write is scripted by the test, and whose
 * `purge` records that it was called at all: the count-first rule means a
 * product with movements must never reach the delete.
 */
function scriptedPurge(
	result: "purged" | "not_found" | "not_deleted" | "has_movements",
): { repository: ProductRepository; purgeCalls: () => number } {
	let calls = 0;

	return {
		repository: {
			purge: async () => {
				calls += 1;

				return result;
			},
		} as unknown as ProductRepository,
		purgeCalls: () => calls,
	};
}

function movement(
	overrides: Partial<Parameters<typeof StockMovement.create>[0]> = {},
) {
	return StockMovement.create({
		id: `movement-${Math.random().toString(36).slice(2)}`,
		companyId: COMPANY,
		productId: "product-1",
		userId: "user-1",
		type: "IN",
		quantity: 1,
		createdAt: new Date("2026-10-21T10:00:00.000Z"),
		...overrides,
	});
}

function movementLedger(...movements: StockMovement[]) {
	const ledger = new InMemoryStockMovementRepository(new Map());

	for (const row of movements) {
		ledger.save(row);
	}

	return ledger;
}

describe("PurgeProductUseCase", () => {
	function purgeProduct(
		productRepository: ProductRepository,
		stockMovementRepository: StockMovementRepository = movementLedger(),
	) {
		return new PurgeProductUseCase({
			productRepository,
			stockMovementRepository,
		});
	}

	it("purges a deleted product without movements as an OWNER", async () => {
		// S2: the trash is the only entry point, so a deleted row is what the
		// purge removes.
		const repository_ = repository();
		seed(repository_, { id: "product-1", deleted: true });

		await expect(
			purgeProduct(repository_).execute(
				{ productId: "product-1" },
				context("OWNER"),
			),
		).resolves.toBeUndefined();

		// The row is gone, not stamped: the history read no longer finds it.
		await expect(
			repository_.findByIds(COMPANY, ["product-1"]),
		).resolves.toEqual([]);
		await expect(repository_.list(COMPANY, { deleted: true })).resolves.toEqual(
			[],
		);
	});

	it("frees the sku, so a new product may take it", async () => {
		const repository_ = repository();
		const deleted = seed(repository_, { id: "product-1", deleted: true });

		await purgeProduct(repository_).execute(
			{ productId: "product-1" },
			context("OWNER"),
		);

		await expect(
			repository_.create(
				Product.create({
					id: "product-2",
					companyId: COMPANY,
					name: "Cafe",
					sku: deleted.sku,
					price: "1500",
				}),
			),
		).resolves.toMatchObject({ id: "product-2", sku: deleted.sku });
	});

	it("rejects an ADMIN with InsufficientRoleError, before reading anything", async () => {
		// S3/L2: purging is irreversible, so it is OWNER-only and separate from
		// `manage_products`; the ADMIN never reaches the count nor the delete.
		const repository_ = repository();
		seed(repository_, { id: "product-1", deleted: true });

		await expect(
			purgeProduct(repository_).execute(
				{ productId: "product-1" },
				context("ADMIN"),
			),
		).rejects.toThrow(InsufficientRoleError);

		await expect(
			repository_.findByIds(COMPANY, ["product-1"]),
		).resolves.toHaveLength(1);
	});

	it("rejects a MEMBER with InsufficientRoleError", async () => {
		const repository_ = repository();
		seed(repository_, { id: "product-1", deleted: true });

		await expect(
			purgeProduct(repository_).execute(
				{ productId: "product-1" },
				context("MEMBER"),
			),
		).rejects.toThrow(InsufficientRoleError);
	});

	it("answers ProductNotDeletedError for an active product and keeps it", async () => {
		// L3: purging an active product would skip the soft delete.
		const repository_ = repository();
		seed(repository_, { id: "product-1" });

		await expect(
			purgeProduct(repository_).execute(
				{ productId: "product-1" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductNotDeletedError);

		await expect(
			repository_.findActiveById(COMPANY, "product-1"),
		).resolves.not.toBeNull();
	});

	it("answers ProductHasMovementsError with the count and deletes nothing", async () => {
		// L4: the count answers a readable 409 without attempting the delete.
		const repository_ = repository();
		seed(repository_, { id: "product-1", deleted: true });
		const ledger = movementLedger(movement(), movement({ type: "OUT" }));

		const error = await purgeProduct(repository_, ledger)
			.execute({ productId: "product-1" }, context("OWNER"))
			.catch((rejection: unknown) => rejection);

		expect(error).toBeInstanceOf(ProductHasMovementsError);
		expect((error as ProductHasMovementsError).movementCount).toBe(2);
		expect((error as ProductHasMovementsError).message).toContain("2");

		// The ledger is the audit trail (MOV-05) and the row is still in the
		// trash: nothing was deleted.
		await expect(
			repository_.findByIds(COMPANY, ["product-1"]),
		).resolves.toHaveLength(1);
		await expect(ledger.countByProduct(COMPANY, "product-1")).resolves.toBe(2);
	});

	it("never attempts the delete when the product has movements", async () => {
		const { repository: scripted, purgeCalls } = scriptedPurge("purged");

		await expect(
			purgeProduct(scripted, movementLedger(movement())).execute(
				{ productId: "product-1" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductHasMovementsError);
		expect(purgeCalls()).toBe(0);
	});

	it("answers ProductNotFoundError for another company's product", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "product-1",
			companyId: OTHER_COMPANY,
			deleted: true,
		});

		await expect(
			purgeProduct(repository_).execute(
				{ productId: "product-1" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductNotFoundError);

		await expect(
			repository_.findByIds(OTHER_COMPANY, ["product-1"]),
		).resolves.toHaveLength(1);
	});

	it("answers ProductNotFoundError for a product that does not exist", async () => {
		await expect(
			purgeProduct(repository()).execute(
				{ productId: "product-nope" },
				context("OWNER"),
			),
		).rejects.toThrow(ProductNotFoundError);
	});

	it("answers ProductHasMovementsError when the delete loses the race to a movement", async () => {
		// S4/L4: a movement can land between the count and the DELETE; the
		// database's FK rejects the row (the adapter's `has_movements`) and the
		// caller gets the same 409, never a 500.
		const { repository: scripted } = scriptedPurge("has_movements");

		const error = await purgeProduct(scripted, scriptedMovementCounts([0, 3]))
			.execute({ productId: "product-1" }, context("OWNER"))
			.catch((rejection: unknown) => rejection);

		expect(error).toBeInstanceOf(ProductHasMovementsError);
		// The re-count reports what is true now, not the stale zero.
		expect((error as ProductHasMovementsError).movementCount).toBe(3);
	});
});
