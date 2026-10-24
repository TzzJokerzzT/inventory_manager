import { Supplier } from "../src/domain/entities/supplier.js";
import { SupplierNameAlreadyExistsError } from "../src/domain/errors/supplier-name-already-exists-error.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaSupplierRepository } from "../src/infrastructure/database/prisma-supplier-repository.js";

/**
 * The adapter talks to the `supplier` delegate only, so the fake narrows the
 * injected surface to what it calls. It is a hand-written double: no database
 * and no generated client is loaded here.
 */
type SupplierDelegate = Pick<PrismaClient, "supplier">;

function buildFakeDelegate() {
	const create = jest.fn();
	const findFirst = jest.fn();
	const findMany = jest.fn();
	const updateMany = jest.fn();

	const delegate = {
		supplier: { create, findFirst, findMany, updateMany },
	} as unknown as SupplierDelegate;

	return { delegate, create, findFirst, findMany, updateMany };
}

const CREATED_AT = new Date("2026-10-20T12:00:00.000Z");
const UPDATED_AT = new Date("2026-10-21T12:00:00.000Z");

function row(overrides: Record<string, unknown> = {}) {
	return {
		id: "supplier-1",
		companyId: "company-1",
		name: "Distribuidora Sur",
		contact: "Juan Perez",
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		deletedAt: null,
		...overrides,
	};
}

function supplier(): Supplier {
	return Supplier.create({
		id: "supplier-1",
		companyId: "company-1",
		name: "Distribuidora Sur",
		contact: "Juan Perez",
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
	});
}

function uniqueViolation(): Error {
	return Object.assign(new Error("Unique constraint failed"), {
		code: "P2002",
	});
}

describe("PrismaSupplierRepository.create", () => {
	it("writes the entity fields and maps the row back into an entity", async () => {
		const { delegate, create } = buildFakeDelegate();
		create.mockResolvedValue(row());

		const created = await new PrismaSupplierRepository({
			prisma: delegate,
		}).create(supplier());

		expect(create).toHaveBeenCalledWith({
			data: {
				id: "supplier-1",
				companyId: "company-1",
				name: "Distribuidora Sur",
				contact: "Juan Perez",
				createdAt: CREATED_AT,
				updatedAt: UPDATED_AT,
			},
		});
		expect(created).toBeInstanceOf(Supplier);
		expect(created).toMatchObject({
			id: "supplier-1",
			companyId: "company-1",
			name: "Distribuidora Sur",
			contact: "Juan Perez",
		});
	});

	it("translates a P2002 unique violation into SupplierNameAlreadyExistsError", async () => {
		const { delegate, create } = buildFakeDelegate();
		create.mockRejectedValue(uniqueViolation());

		const repository = new PrismaSupplierRepository({ prisma: delegate });

		await expect(repository.create(supplier())).rejects.toThrow(
			SupplierNameAlreadyExistsError,
		);
	});

	it("lets any other failure through untouched", async () => {
		const { delegate, create } = buildFakeDelegate();
		const failure = Object.assign(new Error("connection lost"), {
			code: "P1001",
		});
		create.mockRejectedValue(failure);

		const repository = new PrismaSupplierRepository({ prisma: delegate });

		await expect(repository.create(supplier())).rejects.toBe(failure);
	});
});

describe("PrismaSupplierRepository.findById", () => {
	it("filters by company, id and deletedAt: null", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(row());

		const found = await new PrismaSupplierRepository({
			prisma: delegate,
		}).findById("company-1", "supplier-1");

		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "supplier-1", companyId: "company-1", deletedAt: null },
		});
		expect(found).toMatchObject({ id: "supplier-1" });
	});

	it("answers null when no active row matches", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(null);

		await expect(
			new PrismaSupplierRepository({ prisma: delegate }).findById(
				"company-1",
				"supplier-1",
			),
		).resolves.toBeNull();
	});
});

describe("PrismaSupplierRepository.listByCompany", () => {
	it("filters active rows of the company and orders by name and then id", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([
			row({ id: "supplier-a", name: "Alfa" }),
			row({ id: "supplier-z", name: "Zeta" }),
		]);

		const suppliers = await new PrismaSupplierRepository({
			prisma: delegate,
		}).listByCompany("company-1");

		expect(findMany).toHaveBeenCalledWith({
			where: { companyId: "company-1", deletedAt: null },
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});
		expect(suppliers.map((row) => row.id)).toEqual([
			"supplier-a",
			"supplier-z",
		]);
	});
});

describe("PrismaSupplierRepository.update", () => {
	it("writes the mutable fields with the active-row guard and returns the stored row", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(row({ name: "Distribuidora Norte" }));

		const stored = await new PrismaSupplierRepository({
			prisma: delegate,
		}).update(supplier().withChanges({ name: "Distribuidora Norte" }));

		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "supplier-1", companyId: "company-1", deletedAt: null },
			data: {
				name: "Distribuidora Norte",
				contact: "Juan Perez",
				updatedAt: expect.any(Date),
			},
		});
		expect(stored).toMatchObject({ name: "Distribuidora Norte" });
	});

	it("answers null without reading back when no active row matched", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 0 });

		await expect(
			new PrismaSupplierRepository({ prisma: delegate }).update(supplier()),
		).resolves.toBeNull();
		expect(findFirst).not.toHaveBeenCalled();
	});

	it("translates a P2002 unique violation into SupplierNameAlreadyExistsError", async () => {
		const { delegate, updateMany } = buildFakeDelegate();
		updateMany.mockRejectedValue(uniqueViolation());

		const repository = new PrismaSupplierRepository({ prisma: delegate });

		await expect(
			repository.update(supplier().withChanges({ name: "Otra" })),
		).rejects.toThrow(SupplierNameAlreadyExistsError);
	});
});

describe("PrismaSupplierRepository.softDelete", () => {
	it("stamps deletedAt instead of deleting the row and reads back the stamped row", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		const deletedAt = new Date("2026-10-22T12:00:00.000Z");
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(row({ deletedAt, updatedAt: deletedAt }));

		const deleted = await new PrismaSupplierRepository({
			prisma: delegate,
		}).softDelete("company-1", "supplier-1", deletedAt);

		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "supplier-1", companyId: "company-1", deletedAt: null },
			data: { deletedAt, updatedAt: deletedAt },
		});
		// The read-back is not `findById`: that one only ever sees active rows.
		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "supplier-1", companyId: "company-1" },
		});
		expect(deleted?.deletedAt).toBe(deletedAt);
	});

	it("answers null when there was nothing to delete", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 0 });

		await expect(
			new PrismaSupplierRepository({ prisma: delegate }).softDelete(
				"company-1",
				"supplier-1",
				new Date("2026-10-22T12:00:00.000Z"),
			),
		).resolves.toBeNull();
		expect(findFirst).not.toHaveBeenCalled();
	});
});
