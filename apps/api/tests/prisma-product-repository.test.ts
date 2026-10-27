import { Product } from "../src/domain/entities/product.js";
import { SkuAlreadyExistsError } from "../src/domain/errors/sku-already-exists-error.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaProductRepository } from "../src/infrastructure/database/prisma-product-repository.js";

/**
 * The adapter talks to the `product` delegate only, so the fake narrows the
 * injected surface to what it calls. It is a hand-written double: no database
 * and no generated client is loaded here.
 */
type ProductDelegate = Pick<PrismaClient, "product">;

function buildFakeDelegate() {
	const create = jest.fn();
	const findFirst = jest.fn();
	const findMany = jest.fn();
	const updateMany = jest.fn();
	const deleteMany = jest.fn();

	const delegate = {
		product: { create, findFirst, findMany, updateMany, deleteMany },
	} as unknown as ProductDelegate;

	return { delegate, create, findFirst, findMany, updateMany, deleteMany };
}

const CREATED_AT = new Date("2026-10-20T12:00:00.000Z");
const UPDATED_AT = new Date("2026-10-21T12:00:00.000Z");

/**
 * A Prisma `Decimal` is an object whose `toString()` carries the full
 * precision, which is the only shape the adapter may rely on: the generated
 * client is imported type-only, so `instanceof Decimal` is not available.
 */
function decimal(raw: string): { toString: () => string } {
	return { toString: () => raw };
}

function row(overrides: Record<string, unknown> = {}) {
	return {
		id: "product-1",
		companyId: "company-1",
		name: "Cafe molido 500g",
		description: null,
		sku: "CAF-500",
		price: decimal("1500"),
		photoUrl: null,
		stockQuantity: 0,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		deletedAt: null,
		...overrides,
	};
}

function product() {
	return Product.create({
		id: "product-1",
		companyId: "company-1",
		name: "Cafe molido 500g",
		sku: "CAF-500",
		price: "1500",
	});
}

describe("PrismaProductRepository.create", () => {
	it("writes the entity fields and maps the row back into an entity", async () => {
		const { delegate, create } = buildFakeDelegate();
		create.mockResolvedValue(row());

		const repository = new PrismaProductRepository({ prisma: delegate });
		const input = product().withChanges({});
		const created = await repository.create(input);

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			data: {
				id: "product-1",
				companyId: "company-1",
				name: "Cafe molido 500g",
				description: null,
				sku: "CAF-500",
				price: "1500.00",
				photoUrl: null,
				stockQuantity: 0,
				lowStockThreshold: 0,
				measureUnit: "KILOGRAM",
				categoryId: null,
				createdAt: input.createdAt,
				updatedAt: input.updatedAt,
			},
		});
		expect(created).toBeInstanceOf(Product);
	});

	it("translates a P2002 unique violation into SkuAlreadyExistsError", async () => {
		const { delegate, create } = buildFakeDelegate();
		create.mockRejectedValue(
			Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
		);

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(repository.create(product())).rejects.toThrow(
			SkuAlreadyExistsError,
		);
	});

	it("lets any other failure through untouched", async () => {
		const { delegate, create } = buildFakeDelegate();
		const failure = Object.assign(new Error("connection lost"), {
			code: "P1001",
		});
		create.mockRejectedValue(failure);

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(repository.create(product())).rejects.toBe(failure);
	});
});

describe("PrismaProductRepository.findActiveById", () => {
	it("filters by company, id and deletedAt: null", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(row());

		const repository = new PrismaProductRepository({ prisma: delegate });
		const found = await repository.findActiveById("company-1", "product-1");

		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "product-1", companyId: "company-1", deletedAt: null },
		});
		expect(found).toBeInstanceOf(Product);
		expect(found?.id).toBe("product-1");
	});

	it("returns null when no active row matches", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(null);

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(
			repository.findActiveById("company-1", "product-1"),
		).resolves.toBeNull();
	});
});

describe("PrismaProductRepository.findBySku", () => {
	it("does not filter deletedAt, because a deleted product keeps its sku reserved", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(row({ deletedAt: new Date("2026-10-22") }));

		const repository = new PrismaProductRepository({ prisma: delegate });
		const found = await repository.findBySku("company-1", "CAF-500");

		expect(findFirst).toHaveBeenCalledWith({
			where: { companyId: "company-1", sku: "CAF-500" },
		});
		expect(found?.deletedAt).toBeInstanceOf(Date);
	});

	it("returns null when the company has no such sku", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(null);

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(repository.findBySku("company-1", "NOPE")).resolves.toBeNull();
	});
});

describe("PrismaProductRepository.list", () => {
	it("lists the company's active products ordered by name and then id", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([row()]);

		const repository = new PrismaProductRepository({ prisma: delegate });
		const listed = await repository.list("company-1");

		expect(findMany).toHaveBeenCalledWith({
			where: { companyId: "company-1", deletedAt: null },
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});
		expect(listed).toHaveLength(1);
	});

	it("matches the search against the name or the sku, case-insensitively", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([]);

		const repository = new PrismaProductRepository({ prisma: delegate });
		await repository.list("company-1", { search: "cafe" });

		expect(findMany).toHaveBeenCalledWith({
			where: {
				companyId: "company-1",
				deletedAt: null,
				OR: [
					{ name: { contains: "cafe", mode: "insensitive" } },
					{ sku: { contains: "cafe", mode: "insensitive" } },
				],
			},
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});
	});

	it("filters the soft-deleted rows when the trash is asked for", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([row({ deletedAt: new Date("2026-10-22") })]);

		const repository = new PrismaProductRepository({ prisma: delegate });
		const listed = await repository.list("company-1", { deleted: true });

		// The trash replaces the active filter; it is not a union of both.
		expect(findMany).toHaveBeenCalledWith({
			where: { companyId: "company-1", deletedAt: { not: null } },
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});
		expect(listed).toHaveLength(1);
	});

	it("keeps the search inside the trash", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([]);

		const repository = new PrismaProductRepository({ prisma: delegate });
		await repository.list("company-1", { search: "cafe", deleted: true });

		expect(findMany).toHaveBeenCalledWith({
			where: {
				companyId: "company-1",
				deletedAt: { not: null },
				OR: [
					{ name: { contains: "cafe", mode: "insensitive" } },
					{ sku: { contains: "cafe", mode: "insensitive" } },
				],
			},
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});
	});

	it("keeps listing the active products when deleted is false", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([row()]);

		const repository = new PrismaProductRepository({ prisma: delegate });
		await repository.list("company-1", { search: undefined, deleted: false });

		expect(findMany).toHaveBeenCalledWith({
			where: { companyId: "company-1", deletedAt: null },
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});
	});
});

describe("PrismaProductRepository.update", () => {
	it("guards the write on deletedAt: null and re-reads the row", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(row({ name: "Cafe en grano" }));

		const repository = new PrismaProductRepository({ prisma: delegate });
		const updated = product().withChanges({ name: "Cafe en grano" });
		const result = await repository.update(updated);

		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "product-1", companyId: "company-1", deletedAt: null },
			data: {
				name: "Cafe en grano",
				description: null,
				sku: "CAF-500",
				price: "1500.00",
				photoUrl: null,
				measureUnit: "KILOGRAM",
				categoryId: null,
				updatedAt: updated.updatedAt,
			},
		});
		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "product-1", companyId: "company-1", deletedAt: null },
		});
		expect(result?.name).toBe("Cafe en grano");
	});

	it("writes the measure unit the entity carries, so a change is persisted", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(row({ measureUnit: "LITRE" }));

		const repository = new PrismaProductRepository({ prisma: delegate });
		await repository.update(product().withChanges({ measureUnit: "LITRE" }));

		expect(updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ measureUnit: "LITRE" }),
			}),
		);
	});

	it("writes the category the entity carries, so a change and a clear are persisted", async () => {
		// S7: the entity carries the stored category when the change did not name
		// one, so the column cannot drift from it.
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(row({ categoryId: "category-1" }));

		const repository = new PrismaProductRepository({ prisma: delegate });
		await repository.update(
			product().withChanges({ categoryId: "category-1" }),
		);

		expect(updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ categoryId: "category-1" }),
			}),
		);
	});

	it("returns null when the guarded write matches no active row", async () => {
		const { delegate, updateMany } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 0 });

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(
			repository.update(product().withChanges({ name: "Cafe en grano" })),
		).resolves.toBeNull();
	});

	it("translates a P2002 unique violation into SkuAlreadyExistsError", async () => {
		const { delegate, updateMany } = buildFakeDelegate();
		updateMany.mockRejectedValue(
			Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
		);

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(
			repository.update(product().withChanges({ sku: "SUGAR-1" })),
		).rejects.toThrow(SkuAlreadyExistsError);
	});
});

describe("PrismaProductRepository.softDelete", () => {
	it("stamps deletedAt instead of deleting the row", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(row({ deletedAt: new Date("2026-10-22") }));

		const repository = new PrismaProductRepository({ prisma: delegate });
		const deleted = await repository.softDelete("company-1", "product-1");

		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "product-1", companyId: "company-1", deletedAt: null },
			data: { deletedAt: expect.any(Date), updatedAt: expect.any(Date) },
		});
		expect(deleted?.deletedAt).toBeInstanceOf(Date);
	});

	it("returns null when the product was already deleted or is foreign", async () => {
		const { delegate, updateMany } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 0 });

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(
			repository.softDelete("company-1", "product-1"),
		).resolves.toBeNull();
	});
});

describe("PrismaProductRepository.restore", () => {
	it("clears deletedAt only while the row is still deleted, then reads it back", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(row());

		const repository = new PrismaProductRepository({ prisma: delegate });
		const restored = await repository.restore("company-1", "product-1");

		// `deletedAt: { not: null }` is the guard: an active row is not
		// restamped, so two concurrent restores cannot both win (S3).
		expect(updateMany).toHaveBeenCalledWith({
			where: {
				id: "product-1",
				companyId: "company-1",
				deletedAt: { not: null },
			},
			data: { deletedAt: null, updatedAt: expect.any(Date) },
		});
		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "product-1", companyId: "company-1" },
		});
		expect(restored).toBeInstanceOf(Product);
		expect(restored?.deletedAt).toBeNull();
	});

	it("returns null when no deleted row matched, without reading it back", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 0 });

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(
			repository.restore("company-1", "product-1"),
		).resolves.toBeNull();
		expect(findFirst).not.toHaveBeenCalled();
	});

	it("returns null when the row vanished between the write and the read", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(null);

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(
			repository.restore("company-1", "product-1"),
		).resolves.toBeNull();
	});
});

describe("PrismaProductRepository price mapping", () => {
	it("never exposes a float: a Decimal row is normalized to a two-decimal string", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(row({ price: decimal("7.5") }));

		const repository = new PrismaProductRepository({ prisma: delegate });
		const found = await repository.findActiveById("company-1", "product-1");

		expect(found?.price).toBe("7.50");
		expect(found?.toJSON().price).toBe("7.50");
	});

	it("pads an integer Decimal to two decimals", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(row({ price: decimal("1500") }));

		const repository = new PrismaProductRepository({ prisma: delegate });
		const found = await repository.findActiveById("company-1", "product-1");

		expect(found?.price).toBe("1500.00");
	});
});

describe("PrismaProductRepository.findByIds", () => {
	it("reads the requested ids of the company in one query, without the deletedAt filter", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([
			row(),
			row({ id: "product-2", deletedAt: new Date("2026-10-22") }),
		]);

		const repository = new PrismaProductRepository({ prisma: delegate });
		const found = await repository.findByIds("company-1", [
			"product-1",
			"product-2",
		]);

		// No `deletedAt: null`: this is the history read of the stock
		// movements (MOV-05), so a deleted product must stay resolvable.
		expect(findMany).toHaveBeenCalledWith({
			where: { companyId: "company-1", id: { in: ["product-1", "product-2"] } },
		});
		expect(found.map((product) => product.id)).toEqual([
			"product-1",
			"product-2",
		]);
	});
});

describe("PrismaProductRepository.purge", () => {
	it("deletes only a soft-deleted row of the company", async () => {
		const { delegate, deleteMany } = buildFakeDelegate();
		deleteMany.mockResolvedValue({ count: 1 });

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(repository.purge("company-1", "product-1")).resolves.toBe(
			"purged",
		);
		// The trash is the only entry point: the `deletedAt: { not: null }`
		// guard is part of the DELETE, not a read before it.
		expect(deleteMany).toHaveBeenCalledWith({
			where: {
				id: "product-1",
				companyId: "company-1",
				deletedAt: { not: null },
			},
		});
	});

	it("answers not_found when nothing matched and the row does not exist", async () => {
		const { delegate, deleteMany, findFirst } = buildFakeDelegate();
		deleteMany.mockResolvedValue({ count: 0 });
		findFirst.mockResolvedValue(null);

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(repository.purge("company-1", "product-1")).resolves.toBe(
			"not_found",
		);
		// The re-read is scoped by the company, so a foreign row is absent too.
		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "product-1", companyId: "company-1" },
		});
	});

	it("answers not_deleted when nothing matched because the row is active", async () => {
		const { delegate, deleteMany, findFirst } = buildFakeDelegate();
		deleteMany.mockResolvedValue({ count: 0 });
		findFirst.mockResolvedValue(row());

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(repository.purge("company-1", "product-1")).resolves.toBe(
			"not_deleted",
		);
	});

	it("answers has_movements when the foreign key rejects the delete (P2003)", async () => {
		const { delegate, deleteMany, findFirst } = buildFakeDelegate();
		deleteMany.mockRejectedValue(
			Object.assign(new Error("Foreign key constraint violated"), {
				code: "P2003",
			}),
		);

		const repository = new PrismaProductRepository({ prisma: delegate });

		// The race L4 describes: a movement landed after the count, so the
		// database rejects the row and the caller gets the same 409.
		await expect(repository.purge("company-1", "product-1")).resolves.toBe(
			"has_movements",
		);
		expect(findFirst).not.toHaveBeenCalled();
	});

	it("lets any other failure through untouched", async () => {
		const { delegate, deleteMany } = buildFakeDelegate();
		const failure = Object.assign(new Error("connection lost"), {
			code: "P1001",
		});
		deleteMany.mockRejectedValue(failure);

		const repository = new PrismaProductRepository({ prisma: delegate });

		await expect(repository.purge("company-1", "product-1")).rejects.toBe(
			failure,
		);
	});
});
