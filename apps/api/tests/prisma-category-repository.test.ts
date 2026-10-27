import { Category } from "../src/domain/entities/category.js";
import { CategoryNameAlreadyExistsError } from "../src/domain/errors/category-name-already-exists-error.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaCategoryRepository } from "../src/infrastructure/database/prisma-category-repository.js";

/**
 * The adapter talks to the `category` delegate for the rows and to the
 * `product` delegate for the count that guards the delete, so the fake narrows
 * the injected surface to exactly those two. It is a hand-written double: no
 * database and no generated client is loaded here.
 */
type CategoryDelegate = Pick<PrismaClient, "category" | "product">;

function buildFakeDelegate() {
	const create = jest.fn();
	const findFirst = jest.fn();
	const findMany = jest.fn();
	const updateMany = jest.fn();
	const deleteMany = jest.fn();
	const count = jest.fn();

	const delegate = {
		category: { create, findFirst, findMany, updateMany, deleteMany },
		product: { count },
	} as unknown as CategoryDelegate;

	return {
		delegate,
		create,
		findFirst,
		findMany,
		updateMany,
		deleteMany,
		count,
	};
}

const CREATED_AT = new Date("2026-10-20T12:00:00.000Z");
const UPDATED_AT = new Date("2026-10-21T12:00:00.000Z");

function row(overrides: Record<string, unknown> = {}) {
	return {
		id: "category-1",
		companyId: "company-1",
		name: "Bebidas",
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

function category(): Category {
	return Category.create({
		id: "category-1",
		companyId: "company-1",
		name: "Bebidas",
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
	});
}

function uniqueViolation(): Error {
	return Object.assign(new Error("Unique constraint failed"), {
		code: "P2002",
	});
}

function foreignKeyViolation(): Error {
	return Object.assign(new Error("Foreign key constraint failed"), {
		code: "P2003",
	});
}

describe("PrismaCategoryRepository.create", () => {
	it("writes the entity fields and maps the row back into an entity", async () => {
		const { delegate, create } = buildFakeDelegate();
		create.mockResolvedValue(row());

		const created = await new PrismaCategoryRepository({
			prisma: delegate,
		}).create(category());

		expect(create).toHaveBeenCalledWith({
			data: {
				id: "category-1",
				companyId: "company-1",
				name: "Bebidas",
				createdAt: CREATED_AT,
				updatedAt: UPDATED_AT,
			},
		});
		expect(created).toBeInstanceOf(Category);
		expect(created).toMatchObject({
			id: "category-1",
			companyId: "company-1",
			name: "Bebidas",
		});
	});

	it("translates a P2002 unique violation into CategoryNameAlreadyExistsError", async () => {
		const { delegate, create } = buildFakeDelegate();
		create.mockRejectedValue(uniqueViolation());

		const repository = new PrismaCategoryRepository({ prisma: delegate });

		await expect(repository.create(category())).rejects.toThrow(
			CategoryNameAlreadyExistsError,
		);
	});

	it("lets any other failure through untouched", async () => {
		const { delegate, create } = buildFakeDelegate();
		const failure = Object.assign(new Error("connection lost"), {
			code: "P1001",
		});
		create.mockRejectedValue(failure);

		const repository = new PrismaCategoryRepository({ prisma: delegate });

		await expect(repository.create(category())).rejects.toBe(failure);
	});
});

describe("PrismaCategoryRepository.findById", () => {
	it("filters by company and id", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(row());

		const found = await new PrismaCategoryRepository({
			prisma: delegate,
		}).findById("company-1", "category-1");

		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "category-1", companyId: "company-1" },
		});
		expect(found).toMatchObject({ id: "category-1" });
	});

	it("answers null when no row matches in the company", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(null);

		await expect(
			new PrismaCategoryRepository({ prisma: delegate }).findById(
				"company-1",
				"category-1",
			),
		).resolves.toBeNull();
	});
});

describe("PrismaCategoryRepository.listByCompany", () => {
	it("filters by company and orders by name and then id", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([
			row({ id: "category-a", name: "Alfa" }),
			row({ id: "category-z", name: "Zeta" }),
		]);

		const categories = await new PrismaCategoryRepository({
			prisma: delegate,
		}).listByCompany("company-1");

		expect(findMany).toHaveBeenCalledWith({
			where: { companyId: "company-1" },
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});
		expect(categories.map((category) => category.id)).toEqual([
			"category-a",
			"category-z",
		]);
	});
});

describe("PrismaCategoryRepository.findByIds", () => {
	it("reads the categories of the company with the given ids in one query", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([
			row({ id: "category-1", name: "Bebidas" }),
			row({ id: "category-2", name: "Almacén" }),
		]);

		const categories = await new PrismaCategoryRepository({
			prisma: delegate,
		}).findByIds("company-1", ["category-1", "category-2", "category-1"]);

		// The company is part of the WHERE clause, so a foreign id never resolves.
		expect(findMany).toHaveBeenCalledTimes(1);
		expect(findMany).toHaveBeenCalledWith({
			where: {
				companyId: "company-1",
				id: { in: ["category-1", "category-2", "category-1"] },
			},
		});
		expect(categories.map((category) => category.id)).toEqual([
			"category-1",
			"category-2",
		]);
	});

	it("answers an empty array without querying when no id is asked for", async () => {
		const { delegate, findMany } = buildFakeDelegate();

		await expect(
			new PrismaCategoryRepository({ prisma: delegate }).findByIds(
				"company-1",
				[],
			),
		).resolves.toEqual([]);
		expect(findMany).not.toHaveBeenCalled();
	});
});

describe("PrismaCategoryRepository.update", () => {
	it("writes the new name with the company guard and returns the stored row", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(row({ name: "Almacén" }));

		const stored = await new PrismaCategoryRepository({
			prisma: delegate,
		}).update(category().withChanges({ name: "Almacén" }));

		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "category-1", companyId: "company-1" },
			data: { name: "Almacén", updatedAt: expect.any(Date) },
		});
		expect(stored).toMatchObject({ name: "Almacén" });
	});

	it("answers null without reading back when no row of the company matched", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 0 });

		await expect(
			new PrismaCategoryRepository({ prisma: delegate }).update(category()),
		).resolves.toBeNull();
		expect(findFirst).not.toHaveBeenCalled();
	});

	it("translates a P2002 unique violation into CategoryNameAlreadyExistsError", async () => {
		const { delegate, updateMany } = buildFakeDelegate();
		updateMany.mockRejectedValue(uniqueViolation());

		const repository = new PrismaCategoryRepository({ prisma: delegate });

		await expect(
			repository.update(category().withChanges({ name: "Almacén" })),
		).rejects.toThrow(CategoryNameAlreadyExistsError);
	});
});

describe("PrismaCategoryRepository.countProducts", () => {
	it("counts every product of the company pointing at the category, deleted rows included", async () => {
		const { delegate, count } = buildFakeDelegate();
		count.mockResolvedValue(3);

		const productCount = await new PrismaCategoryRepository({
			prisma: delegate,
		}).countProducts("company-1", "category-1");

		// No `deletedAt` predicate on purpose: the `ON DELETE RESTRICT` foreign
		// key covers the soft-deleted rows too, so they block the delete as well.
		expect(count).toHaveBeenCalledWith({
			where: { companyId: "company-1", categoryId: "category-1" },
		});
		expect(productCount).toBe(3);
	});
});

describe("PrismaCategoryRepository.delete", () => {
	it("deletes the row of the company and reports it", async () => {
		const { delegate, deleteMany } = buildFakeDelegate();
		deleteMany.mockResolvedValue({ count: 1 });

		const result = await new PrismaCategoryRepository({
			prisma: delegate,
		}).delete("company-1", "category-1");

		expect(deleteMany).toHaveBeenCalledWith({
			where: { id: "category-1", companyId: "company-1" },
		});
		expect(result).toBe("deleted");
	});

	it("reports not_found when no row of the company matched", async () => {
		const { delegate, deleteMany } = buildFakeDelegate();
		deleteMany.mockResolvedValue({ count: 0 });

		await expect(
			new PrismaCategoryRepository({ prisma: delegate }).delete(
				"company-1",
				"category-1",
			),
		).resolves.toBe("not_found");
	});

	it("translates a P2003 foreign key violation into in_use, so the race answers the same 409", async () => {
		const { delegate, deleteMany } = buildFakeDelegate();
		deleteMany.mockRejectedValue(foreignKeyViolation());

		await expect(
			new PrismaCategoryRepository({ prisma: delegate }).delete(
				"company-1",
				"category-1",
			),
		).resolves.toBe("in_use");
	});

	it("lets any other failure through untouched", async () => {
		const { delegate, deleteMany } = buildFakeDelegate();
		const failure = Object.assign(new Error("connection lost"), {
			code: "P1001",
		});
		deleteMany.mockRejectedValue(failure);

		const repository = new PrismaCategoryRepository({ prisma: delegate });

		await expect(repository.delete("company-1", "category-1")).rejects.toBe(
			failure,
		);
	});
});
