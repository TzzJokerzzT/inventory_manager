import { Product } from "../src/domain/entities/product.js";
import { SkuAlreadyExistsError } from "../src/domain/errors/sku-already-exists-error.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";

function product(
	overrides: Partial<Parameters<typeof Product.create>[0]> = {},
) {
	return Product.create({
		id: "product-1",
		companyId: COMPANY,
		name: "Cafe molido 500g",
		sku: "CAF-500",
		price: "1500",
		...overrides,
	});
}

function repositoryWith(products: Product[]): InMemoryProductRepository {
	return new InMemoryProductRepository(products);
}

describe("InMemoryProductRepository.create", () => {
	it("stores exactly the entity it was given and returns it", async () => {
		const repository = repositoryWith([]);
		const created = product();

		await expect(repository.create(created)).resolves.toBe(created);
		await expect(repository.findActiveById(COMPANY, "product-1")).resolves.toBe(
			created,
		);
	});

	it("refuses a duplicate sku, comparing case-insensitively", async () => {
		const repository = repositoryWith([product()]);

		await expect(
			repository.create(
				product({ id: "product-2", name: "Otro", sku: "caf-500" }),
			),
		).rejects.toThrow(SkuAlreadyExistsError);
	});

	it("lets two companies hold the same sku", async () => {
		const repository = repositoryWith([product()]);

		await expect(
			repository.create(product({ id: "product-2", companyId: OTHER_COMPANY })),
		).resolves.toMatchObject({ id: "product-2" });
	});

	it("treats a soft-deleted sku as reserved", async () => {
		const repository = repositoryWith([
			product({ deletedAt: new Date("2026-10-22T12:00:00.000Z") }),
		]);

		await expect(
			repository.create(product({ id: "product-2", name: "Otro" })),
		).rejects.toThrow(SkuAlreadyExistsError);
	});
});

describe("InMemoryProductRepository.findActiveById", () => {
	it("returns null for another company's product", async () => {
		const repository = repositoryWith([product({ companyId: OTHER_COMPANY })]);

		await expect(
			repository.findActiveById(COMPANY, "product-1"),
		).resolves.toBeNull();
	});

	it("returns null for a soft-deleted product", async () => {
		const repository = repositoryWith([
			product({ deletedAt: new Date("2026-10-22T12:00:00.000Z") }),
		]);

		await expect(
			repository.findActiveById(COMPANY, "product-1"),
		).resolves.toBeNull();
	});
});

describe("InMemoryProductRepository.findBySku", () => {
	it("finds a soft-deleted product, because its sku stays reserved", async () => {
		const deleted = product({
			deletedAt: new Date("2026-10-22T12:00:00.000Z"),
		});
		const repository = repositoryWith([deleted]);

		await expect(repository.findBySku(COMPANY, "CAF-500")).resolves.toBe(
			deleted,
		);
	});

	it("is scoped to the company", async () => {
		const repository = repositoryWith([product({ companyId: OTHER_COMPANY })]);

		await expect(repository.findBySku(COMPANY, "CAF-500")).resolves.toBeNull();
	});
});

describe("InMemoryProductRepository.list", () => {
	it("returns only the company's active products, ordered by name then id", async () => {
		const repository = repositoryWith([
			product({ id: "product-b", name: "Zapallo" }),
			product({ id: "product-a", name: "Cafe" }),
			product({ id: "product-c", name: "Cafe" }),
			product({
				id: "product-d",
				name: "Deleted",
				sku: "DEL-1",
				deletedAt: new Date("2026-10-22T12:00:00.000Z"),
			}),
			product({ id: "product-e", companyId: OTHER_COMPANY, name: "Ajeno" }),
		]);

		const listed = await repository.list(COMPANY);

		expect(listed.map((row) => row.id)).toEqual([
			"product-a",
			"product-c",
			"product-b",
		]);
	});

	it("matches the search against the name or the sku, case-insensitively", async () => {
		const repository = repositoryWith([
			product({ id: "product-1", name: "Cafe molido 500g", sku: "CAF-500" }),
			product({ id: "product-2", name: "Azucar", sku: "SUGAR-1" }),
			product({ id: "product-3", name: "Yerba", sku: "YERBA-CAFE" }),
		]);

		const byName = await repository.list(COMPANY, "cafe");
		const bySku = await repository.list(COMPANY, "caf-5");

		expect(byName.map((row) => row.id)).toEqual(["product-1", "product-3"]);
		expect(bySku.map((row) => row.id)).toEqual(["product-1"]);
	});

	it("returns an empty list for a company with no products", async () => {
		await expect(repositoryWith([]).list(COMPANY)).resolves.toEqual([]);
	});
});

describe("InMemoryProductRepository.update", () => {
	it("replaces the stored product and returns the new state", async () => {
		const repository = repositoryWith([product()]);
		const updated = product().withChanges({ name: "Cafe en grano" });

		await expect(repository.update(updated)).resolves.toBe(updated);
		await expect(
			repository.findActiveById(COMPANY, "product-1"),
		).resolves.toMatchObject({ name: "Cafe en grano" });
	});

	it("returns null for a soft-deleted product", async () => {
		const deleted = product({
			deletedAt: new Date("2026-10-22T12:00:00.000Z"),
		});
		const repository = repositoryWith([deleted]);

		await expect(
			repository.update(deleted.withChanges({ name: "Cafe en grano" })),
		).resolves.toBeNull();
	});

	it("returns null for another company's product", async () => {
		const repository = repositoryWith([
			product({ id: "product-1", companyId: OTHER_COMPANY }),
		]);

		// A write that names a product of another company under this company's
		// context matches no row: the company is part of the WHERE clause.
		await expect(
			repository.update(product().withChanges({ name: "Cafe en grano" })),
		).resolves.toBeNull();
	});

	it("refuses to take a sku another product of the company already has", async () => {
		const repository = repositoryWith([
			product(),
			product({ id: "product-2", name: "Azucar", sku: "SUGAR-1" }),
		]);

		await expect(
			repository.update(
				product({ id: "product-2" }).withChanges({ sku: "caf-500" }),
			),
		).rejects.toThrow(SkuAlreadyExistsError);
	});

	it("lets a product keep its own sku", async () => {
		const repository = repositoryWith([product()]);

		await expect(
			repository.update(product().withChanges({ name: "Cafe en grano" })),
		).resolves.toMatchObject({ sku: "CAF-500" });
	});
});

describe("InMemoryProductRepository.softDelete", () => {
	it("stamps deletedAt and keeps the row", async () => {
		const repository = repositoryWith([product()]);

		const deleted = await repository.softDelete(COMPANY, "product-1");

		expect(deleted?.deletedAt).toBeInstanceOf(Date);
		await expect(repository.list(COMPANY)).resolves.toEqual([]);
	});

	it("returns null on a second delete, because the product already left the catalogue", async () => {
		const repository = repositoryWith([product()]);

		await repository.softDelete(COMPANY, "product-1");

		await expect(
			repository.softDelete(COMPANY, "product-1"),
		).resolves.toBeNull();
	});

	it("returns null for another company's product", async () => {
		const repository = repositoryWith([product({ companyId: OTHER_COMPANY })]);

		await expect(
			repository.softDelete(COMPANY, "product-1"),
		).resolves.toBeNull();
	});
});
