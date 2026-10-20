import { CreateProductUseCase } from "../src/application/use-cases/create-product.js";
import { DeleteProductUseCase } from "../src/application/use-cases/delete-product.js";
import { GetProductUseCase } from "../src/application/use-cases/get-product.js";
import { ListProductsUseCase } from "../src/application/use-cases/list-products.js";
import { UpdateProductUseCase } from "../src/application/use-cases/update-product.js";
import type { MembershipRole } from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { DomainError } from "../src/domain/errors/domain-error.js";
import { InsufficientRoleError } from "../src/domain/errors/insufficient-role-error.js";
import { ProductNotFoundError } from "../src/domain/errors/product-not-found-error.js";
import { SkuAlreadyExistsError } from "../src/domain/errors/sku-already-exists-error.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";

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
		return new ListProductsUseCase({ productRepository: repository_ });
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
});

describe("GetProductUseCase", () => {
	function getProduct(repository_: InMemoryProductRepository) {
		return new GetProductUseCase({ productRepository: repository_ });
	}

	it("returns the product of the company", async () => {
		const repository_ = repository();
		const product = seed(repository_, { id: "product-1" });

		await expect(
			getProduct(repository_).execute(
				{ productId: "product-1" },
				{ companyId: COMPANY },
			),
		).resolves.toBe(product);
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
