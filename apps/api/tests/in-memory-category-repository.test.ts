import { Category } from "../src/domain/entities/category.js";
import { Product } from "../src/domain/entities/product.js";
import { CategoryNameAlreadyExistsError } from "../src/domain/errors/category-name-already-exists-error.js";
import { InMemoryCategoryRepository } from "../src/infrastructure/database/in-memory-category-repository.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";

function repositories() {
	const products = new InMemoryProductRepository();

	return { products, categories: new InMemoryCategoryRepository(products) };
}

function category(overrides: Partial<Parameters<typeof Category.create>[0]>) {
	return Category.create({
		companyId: COMPANY,
		name: "Bebidas",
		...overrides,
	});
}

function product(overrides: {
	id: string;
	categoryId: string | null;
	companyId?: string;
	deleted?: boolean;
}): Product {
	return Product.create({
		id: overrides.id,
		companyId: overrides.companyId ?? COMPANY,
		name: `Product ${overrides.id}`,
		sku: `SKU-${overrides.id}`,
		price: "100.00",
		categoryId: overrides.categoryId,
		deletedAt: overrides.deleted ? new Date("2026-10-22T12:00:00.000Z") : null,
	});
}

describe("InMemoryCategoryRepository.create", () => {
	it("stores the category and rejects a duplicated name of the same company", async () => {
		const { categories } = repositories();

		const first = await categories.create(category({ name: "Bebidas" }));

		expect(first.name).toBe("Bebidas");
		await expect(
			categories.create(category({ name: "Bebidas" })),
		).rejects.toThrow(CategoryNameAlreadyExistsError);
		await expect(categories.listByCompany(COMPANY)).resolves.toHaveLength(1);
	});

	it("accepts the same name with another case, exactly like the case-sensitive index", async () => {
		const { categories } = repositories();

		await categories.create(category({ name: "Bebidas" }));
		const second = await categories.create(category({ name: "bebidas" }));

		expect(second.name).toBe("bebidas");
		await expect(categories.listByCompany(COMPANY)).resolves.toHaveLength(2);
	});

	it("accepts the same name in another company", async () => {
		const { categories } = repositories();

		await categories.create(category({ name: "Bebidas" }));
		const foreign = await categories.create(
			category({ name: "Bebidas", companyId: OTHER_COMPANY }),
		);

		expect(foreign.companyId).toBe(OTHER_COMPANY);
	});
});

describe("InMemoryCategoryRepository.findById", () => {
	it("resolves a category of the company and answers null for another company's", async () => {
		const { categories } = repositories();
		const stored = await categories.create(category({ id: "category-1" }));

		await expect(categories.findById(COMPANY, "category-1")).resolves.toBe(
			stored,
		);
		await expect(
			categories.findById(OTHER_COMPANY, "category-1"),
		).resolves.toBeNull();
		await expect(
			categories.findById(COMPANY, "category-404"),
		).resolves.toBeNull();
	});
});

describe("InMemoryCategoryRepository.findByIds", () => {
	it("resolves the categories of the company with the given ids and never another company's", async () => {
		const { categories } = repositories();
		await categories.create(category({ id: "category-1", name: "Bebidas" }));
		await categories.create(category({ id: "category-2", name: "Almacén" }));
		await categories.create(
			category({ id: "category-x", name: "Ajena", companyId: OTHER_COMPANY }),
		);

		const found = await categories.findByIds(COMPANY, [
			"category-1",
			"category-x",
			"category-404",
		]);

		// An id with no row in the company is simply absent, never invented.
		expect(found.map((row) => row.id)).toEqual(["category-1"]);
	});

	it("answers one row per id even when an id repeats", async () => {
		const { categories } = repositories();
		await categories.create(category({ id: "category-1", name: "Bebidas" }));

		await expect(
			categories.findByIds(COMPANY, ["category-1", "category-1"]),
		).resolves.toHaveLength(1);
	});

	it("answers an empty array without ids", async () => {
		const { categories } = repositories();

		await expect(categories.findByIds(COMPANY, [])).resolves.toEqual([]);
	});
});

describe("InMemoryCategoryRepository.listByCompany", () => {
	it("orders by name and then id and never mixes companies", async () => {
		const { categories } = repositories();
		await categories.create(category({ id: "category-z", name: "Zeta" }));
		await categories.create(category({ id: "category-m", name: "Alfa" }));
		// Seeded through `save` because the port forbids two categories with the
		// same name in one company, and the id tie-break needs that second row.
		categories.save(category({ id: "category-a", name: "Alfa" }));
		await categories.create(
			category({ id: "category-x", name: "Ajena", companyId: OTHER_COMPANY }),
		);

		const listed = await categories.listByCompany(COMPANY);

		expect(listed.map((row) => row.id)).toEqual([
			"category-a",
			"category-m",
			"category-z",
		]);
	});

	it("answers an empty array without rows", async () => {
		const { categories } = repositories();

		await expect(categories.listByCompany(COMPANY)).resolves.toEqual([]);
	});
});

describe("InMemoryCategoryRepository.update", () => {
	it("replaces the stored row under the same id", async () => {
		const { categories } = repositories();
		const stored = await categories.create(category({ id: "category-1" }));

		const updated = await categories.update(
			stored.withChanges({ name: "  Almacén  " }),
		);

		expect(updated?.name).toBe("Almacén");
		await expect(categories.findById(COMPANY, "category-1")).resolves.toBe(
			updated,
		);
	});

	it("answers null for an absent or foreign category", async () => {
		const { categories } = repositories();
		await categories.create(
			category({ id: "category-1", companyId: OTHER_COMPANY }),
		);

		await expect(
			categories.update(category({ id: "category-404" })),
		).resolves.toBeNull();
		await expect(
			categories.update(category({ id: "category-1" })),
		).resolves.toBeNull();
	});

	it("rejects a name another category of the company already holds, but not its own", async () => {
		const { categories } = repositories();
		const first = await categories.create(
			category({ id: "category-1", name: "Bebidas" }),
		);
		const second = await categories.create(
			category({ id: "category-2", name: "Almacén" }),
		);

		await expect(
			categories.update(second.withChanges({ name: "Bebidas" })),
		).rejects.toThrow(CategoryNameAlreadyExistsError);
		await expect(
			categories.update(first.withChanges({ name: "Bebidas" })),
		).resolves.toMatchObject({ name: "Bebidas" });
	});
});

describe("InMemoryCategoryRepository.countProducts", () => {
	it("counts the products of the company, including the soft-deleted ones", async () => {
		const { categories, products } = repositories();
		products.save(product({ id: "product-1", categoryId: "category-1" }));
		products.save(product({ id: "product-2", categoryId: "category-1" }));
		products.save(
			product({ id: "product-3", categoryId: "category-1", deleted: true }),
		);
		products.save(product({ id: "product-4", categoryId: null }));

		await expect(categories.countProducts(COMPANY, "category-1")).resolves.toBe(
			3,
		);
		await expect(
			categories.countProducts(COMPANY, "category-404"),
		).resolves.toBe(0);
	});

	it("never counts the products of another company", async () => {
		const { categories, products } = repositories();
		products.save(
			product({
				id: "product-1",
				categoryId: "category-1",
				companyId: OTHER_COMPANY,
			}),
		);

		await expect(categories.countProducts(COMPANY, "category-1")).resolves.toBe(
			0,
		);
	});
});

describe("InMemoryCategoryRepository.delete", () => {
	it("removes the row for good", async () => {
		const { categories } = repositories();
		await categories.create(category({ id: "category-1" }));

		await expect(categories.delete(COMPANY, "category-1")).resolves.toBe(
			"deleted",
		);
		await expect(categories.listByCompany(COMPANY)).resolves.toEqual([]);
	});

	it("answers not_found for an absent or foreign category", async () => {
		const { categories } = repositories();
		await categories.create(
			category({ id: "category-1", companyId: OTHER_COMPANY }),
		);

		await expect(categories.delete(COMPANY, "category-404")).resolves.toBe(
			"not_found",
		);
		await expect(categories.delete(COMPANY, "category-1")).resolves.toBe(
			"not_found",
		);
	});

	it("answers in_use and keeps the row while a product references it", async () => {
		const { categories, products } = repositories();
		await categories.create(category({ id: "category-1" }));
		products.save(product({ id: "product-1", categoryId: "category-1" }));

		await expect(categories.delete(COMPANY, "category-1")).resolves.toBe(
			"in_use",
		);
		await expect(
			categories.findById(COMPANY, "category-1"),
		).resolves.not.toBeNull();
	});
});
