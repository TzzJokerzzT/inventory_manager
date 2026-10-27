import { CreateCategoryUseCase } from "../src/application/use-cases/create-category.js";
import { DeleteCategoryUseCase } from "../src/application/use-cases/delete-category.js";
import { ListCategoriesUseCase } from "../src/application/use-cases/list-categories.js";
import { UpdateCategoryUseCase } from "../src/application/use-cases/update-category.js";
import { Category } from "../src/domain/entities/category.js";
import type { MembershipRole } from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { CategoryInUseError } from "../src/domain/errors/category-in-use-error.js";
import { CategoryNameAlreadyExistsError } from "../src/domain/errors/category-name-already-exists-error.js";
import { CategoryNotFoundError } from "../src/domain/errors/category-not-found-error.js";
import { DomainError } from "../src/domain/errors/domain-error.js";
import { InsufficientRoleError } from "../src/domain/errors/insufficient-role-error.js";
import { InMemoryCategoryRepository } from "../src/infrastructure/database/in-memory-category-repository.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";

interface SeedCategoryInput {
	id: string;
	companyId?: string;
	name?: string;
}

interface SeedProductInput {
	id: string;
	categoryId: string | null;
	companyId?: string;
	deleted?: boolean;
}

/**
 * The category adapter counts the products of a company that point at a
 * category before allowing a delete, so it composes the product store instead
 * of keeping a second copy of the references.
 */
function repositories() {
	const products = new InMemoryProductRepository();
	const categories = new InMemoryCategoryRepository(products);

	return { products, categories };
}

function seedCategory(
	repository: InMemoryCategoryRepository,
	input: SeedCategoryInput,
): Category {
	const category = Category.create({
		id: input.id,
		companyId: input.companyId ?? COMPANY,
		name: input.name ?? `Category ${input.id}`,
	});

	repository.save(category);

	return category;
}

function seedProduct(
	products: InMemoryProductRepository,
	input: SeedProductInput,
): Product {
	const product = Product.create({
		id: input.id,
		companyId: input.companyId ?? COMPANY,
		name: `Product ${input.id}`,
		sku: `SKU-${input.id}`,
		price: "100.00",
		categoryId: input.categoryId,
		deletedAt: input.deleted ? new Date("2026-10-22T12:00:00.000Z") : null,
	});

	products.save(product);

	return product;
}

function context(actorRole: MembershipRole = "OWNER") {
	return { companyId: COMPANY, actorRole };
}

describe("CreateCategoryUseCase", () => {
	function createCategory(repository: InMemoryCategoryRepository) {
		return new CreateCategoryUseCase({ categoryRepository: repository });
	}

	it.each<MembershipRole>(["OWNER", "ADMIN"])(
		"creates the category as a %s, because writing is `manage_products`",
		async (actorRole) => {
			const { categories } = repositories();

			const created = await createCategory(categories).execute(
				{ name: "  Bebidas  " },
				context(actorRole),
			);

			expect(created).toMatchObject({
				companyId: COMPANY,
				name: "Bebidas",
			});
		},
	);

	it("rejects a MEMBER and stores nothing", async () => {
		const { categories } = repositories();

		await expect(
			createCategory(categories).execute(
				{ name: "Bebidas" },
				context("MEMBER"),
			),
		).rejects.toThrow(InsufficientRoleError);
		await expect(categories.listByCompany(COMPANY)).resolves.toEqual([]);
	});

	it("persists the category it returns", async () => {
		const { categories } = repositories();

		const created = await createCategory(categories).execute(
			{ name: "Bebidas" },
			context(),
		);

		await expect(categories.findById(COMPANY, created.id)).resolves.toBe(
			created,
		);
	});

	it("rejects an invalid name before anything is stored", async () => {
		const { categories } = repositories();

		await expect(
			createCategory(categories).execute({ name: "   " }, context()),
		).rejects.toThrow(DomainError);
		await expect(categories.listByCompany(COMPANY)).resolves.toEqual([]);
	});

	it("rejects a duplicated name in the same company and keeps only the first", async () => {
		const { categories } = repositories();
		const useCase = createCategory(categories);

		await useCase.execute({ name: "Bebidas" }, context());

		await expect(
			useCase.execute({ name: "Bebidas" }, context()),
		).rejects.toThrow(CategoryNameAlreadyExistsError);
		await expect(categories.listByCompany(COMPANY)).resolves.toHaveLength(1);
	});

	it("accepts the same name with a different case, because the index is case-sensitive", async () => {
		const { categories } = repositories();
		const useCase = createCategory(categories);

		await useCase.execute({ name: "Bebidas" }, context());
		const created = await useCase.execute({ name: "bebidas" }, context());

		expect(created.name).toBe("bebidas");
		await expect(categories.listByCompany(COMPANY)).resolves.toHaveLength(2);
	});

	it("accepts the same name in another company", async () => {
		const { categories } = repositories();
		const useCase = createCategory(categories);

		await useCase.execute({ name: "Bebidas" }, context());
		const other = await useCase.execute(
			{ name: "Bebidas" },
			{ companyId: OTHER_COMPANY, actorRole: "OWNER" },
		);

		expect(other.companyId).toBe(OTHER_COMPANY);
	});
});

describe("ListCategoriesUseCase", () => {
	function listCategories(repository: InMemoryCategoryRepository) {
		return new ListCategoriesUseCase({ categoryRepository: repository });
	}

	it("lists the company's categories ordered by name and then id", async () => {
		const { categories } = repositories();
		seedCategory(categories, { id: "category-z", name: "Zeta" });
		seedCategory(categories, { id: "category-a", name: "Alfa" });
		seedCategory(categories, { id: "category-m", name: "Alfa" });

		const listed = await listCategories(categories).execute({
			companyId: COMPANY,
		});

		expect(listed.map((category) => category.id)).toEqual([
			"category-a",
			"category-m",
			"category-z",
		]);
	});

	it("never lists another company's categories", async () => {
		const { categories } = repositories();
		seedCategory(categories, { id: "category-1", name: "Propia" });
		seedCategory(categories, {
			id: "category-2",
			name: "Ajena",
			companyId: OTHER_COMPANY,
		});

		const listed = await listCategories(categories).execute({
			companyId: COMPANY,
		});

		expect(listed.map((category) => category.name)).toEqual(["Propia"]);
	});

	it("answers an empty array for a company without categories", async () => {
		const { categories } = repositories();

		await expect(
			listCategories(categories).execute({ companyId: COMPANY }),
		).resolves.toEqual([]);
	});
});

describe("UpdateCategoryUseCase", () => {
	function updateCategory(repository: InMemoryCategoryRepository) {
		return new UpdateCategoryUseCase({ categoryRepository: repository });
	}

	it("renames the category and stores the new name", async () => {
		const { categories } = repositories();
		seedCategory(categories, { id: "category-1", name: "Bebidas" });

		const updated = await updateCategory(categories).execute(
			{ categoryId: "category-1", name: "  Almacén  " },
			context(),
		);

		expect(updated.name).toBe("Almacén");
		await expect(categories.findById(COMPANY, "category-1")).resolves.toBe(
			updated,
		);
	});

	it("rejects a MEMBER and leaves the stored row untouched", async () => {
		const { categories } = repositories();
		const stored = seedCategory(categories, {
			id: "category-1",
			name: "Bebidas",
		});

		await expect(
			updateCategory(categories).execute(
				{ categoryId: "category-1", name: "Almacén" },
				context("MEMBER"),
			),
		).rejects.toThrow(InsufficientRoleError);
		await expect(categories.findById(COMPANY, "category-1")).resolves.toBe(
			stored,
		);
	});

	it("rejects an absent category without writing anything", async () => {
		const { categories } = repositories();

		await expect(
			updateCategory(categories).execute(
				{ categoryId: "category-404", name: "Almacén" },
				context(),
			),
		).rejects.toThrow(CategoryNotFoundError);
		await expect(categories.listByCompany(COMPANY)).resolves.toEqual([]);
	});

	it("rejects another company's category and leaves it untouched", async () => {
		const { categories } = repositories();
		const foreign = seedCategory(categories, {
			id: "category-1",
			name: "Ajena",
			companyId: OTHER_COMPANY,
		});

		await expect(
			updateCategory(categories).execute(
				{ categoryId: "category-1", name: "Almacén" },
				context(),
			),
		).rejects.toThrow(CategoryNotFoundError);
		await expect(
			categories.findById(OTHER_COMPANY, "category-1"),
		).resolves.toBe(foreign);
	});

	it("rejects a rename onto a name the company already uses and keeps the old name", async () => {
		const { categories } = repositories();
		seedCategory(categories, { id: "category-1", name: "Bebidas" });
		seedCategory(categories, { id: "category-2", name: "Almacén" });

		await expect(
			updateCategory(categories).execute(
				{ categoryId: "category-2", name: "Bebidas" },
				context(),
			),
		).rejects.toThrow(CategoryNameAlreadyExistsError);
		await expect(
			categories.findById(COMPANY, "category-2"),
		).resolves.toMatchObject({ name: "Almacén" });
	});

	it("accepts keeping its own name", async () => {
		const { categories } = repositories();
		seedCategory(categories, { id: "category-1", name: "Bebidas" });

		const updated = await updateCategory(categories).execute(
			{ categoryId: "category-1", name: "Bebidas" },
			context(),
		);

		expect(updated.name).toBe("Bebidas");
	});
});

describe("DeleteCategoryUseCase", () => {
	function deleteCategory(repository: InMemoryCategoryRepository) {
		return new DeleteCategoryUseCase({ categoryRepository: repository });
	}

	it("hard-deletes an unused category, so it leaves every read", async () => {
		const { categories } = repositories();
		seedCategory(categories, { id: "category-1", name: "Bebidas" });

		await deleteCategory(categories).execute(
			{ categoryId: "category-1" },
			context(),
		);

		await expect(
			categories.findById(COMPANY, "category-1"),
		).resolves.toBeNull();
		await expect(categories.listByCompany(COMPANY)).resolves.toEqual([]);
	});

	it("answers a second delete with the same not-found error", async () => {
		const { categories } = repositories();
		seedCategory(categories, { id: "category-1", name: "Bebidas" });
		const useCase = deleteCategory(categories);

		await useCase.execute({ categoryId: "category-1" }, context());

		await expect(
			useCase.execute({ categoryId: "category-1" }, context()),
		).rejects.toThrow(CategoryNotFoundError);
	});

	it("answers an absent or foreign category with the same not-found error", async () => {
		const { categories } = repositories();
		const foreign = seedCategory(categories, {
			id: "category-1",
			name: "Ajena",
			companyId: OTHER_COMPANY,
		});
		const useCase = deleteCategory(categories);

		await expect(
			useCase.execute({ categoryId: "category-404" }, context()),
		).rejects.toThrow(CategoryNotFoundError);
		await expect(
			useCase.execute({ categoryId: "category-1" }, context()),
		).rejects.toThrow(CategoryNotFoundError);
		await expect(
			categories.findById(OTHER_COMPANY, "category-1"),
		).resolves.toBe(foreign);
	});

	it("rejects a MEMBER and leaves the row in place", async () => {
		const { categories } = repositories();
		const stored = seedCategory(categories, {
			id: "category-1",
			name: "Bebidas",
		});

		await expect(
			deleteCategory(categories).execute(
				{ categoryId: "category-1" },
				context("MEMBER"),
			),
		).rejects.toThrow(InsufficientRoleError);
		await expect(categories.findById(COMPANY, "category-1")).resolves.toBe(
			stored,
		);
	});

	it("rejects a category a product still references and keeps the row", async () => {
		const { categories, products } = repositories();
		seedCategory(categories, { id: "category-1", name: "Bebidas" });
		seedProduct(products, { id: "product-1", categoryId: "category-1" });

		await expect(
			deleteCategory(categories).execute(
				{ categoryId: "category-1" },
				context(),
			),
		).rejects.toThrow(CategoryInUseError);
		await expect(
			categories.findById(COMPANY, "category-1"),
		).resolves.not.toBeNull();
	});

	it("counts a soft-deleted product too, because the foreign key is RESTRICT for every row", async () => {
		const { categories, products } = repositories();
		seedCategory(categories, { id: "category-1", name: "Bebidas" });
		seedProduct(products, {
			id: "product-1",
			categoryId: "category-1",
			deleted: true,
		});

		await expect(
			deleteCategory(categories).execute(
				{ categoryId: "category-1" },
				context(),
			),
		).rejects.toThrow(CategoryInUseError);
	});

	it("reports how many products block the delete", async () => {
		const { categories, products } = repositories();
		seedCategory(categories, { id: "category-1", name: "Bebidas" });
		seedProduct(products, { id: "product-1", categoryId: "category-1" });
		seedProduct(products, { id: "product-2", categoryId: "category-1" });

		await expect(
			deleteCategory(categories).execute(
				{ categoryId: "category-1" },
				context(),
			),
		).rejects.toThrow("in use by 2 products");
	});

	it("ignores the products of another company and the ones with no category", async () => {
		const { categories, products } = repositories();
		seedCategory(categories, { id: "category-1", name: "Bebidas" });
		seedProduct(products, {
			id: "product-1",
			categoryId: "category-1",
			companyId: OTHER_COMPANY,
		});
		seedProduct(products, { id: "product-2", categoryId: null });

		await deleteCategory(categories).execute(
			{ categoryId: "category-1" },
			context(),
		);

		await expect(
			categories.findById(COMPANY, "category-1"),
		).resolves.toBeNull();
	});
});
