import { Customer } from "../src/domain/entities/customer.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaCustomerRepository } from "../src/infrastructure/database/prisma-customer-repository.js";

/**
 * The adapter talks to the `customer` delegate only, so the fake narrows the
 * injected surface to what it calls. It is a hand-written double: no database
 * and no generated client is loaded here.
 */
type CustomerDelegate = Pick<PrismaClient, "customer">;

function buildFakeDelegate() {
	const create = jest.fn();
	const findFirst = jest.fn();
	const findMany = jest.fn();
	const updateMany = jest.fn();

	const delegate = {
		customer: { create, findFirst, findMany, updateMany },
	} as unknown as CustomerDelegate;

	return { delegate, create, findFirst, findMany, updateMany };
}

const CREATED_AT = new Date("2026-10-20T12:00:00.000Z");
const UPDATED_AT = new Date("2026-10-21T12:00:00.000Z");
const DELETED_AT = new Date("2026-10-22T12:00:00.000Z");

function row(overrides: Record<string, unknown> = {}) {
	return {
		id: "customer-1",
		companyId: "company-1",
		name: "Maria Gonzalez",
		email: "maria@example.com",
		phone: "+54 11 5555-1234",
		address: "Av. Siempre Viva 742",
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		deletedAt: null,
		...overrides,
	};
}

function customer() {
	return Customer.create({
		id: "customer-1",
		companyId: "company-1",
		name: "Maria Gonzalez",
		email: "maria@example.com",
		phone: "+54 11 5555-1234",
		address: "Av. Siempre Viva 742",
	});
}

describe("PrismaCustomerRepository.create", () => {
	it("writes the entity fields and maps the row back into an entity", async () => {
		const { delegate, create } = buildFakeDelegate();
		create.mockResolvedValue(row());

		const repository = new PrismaCustomerRepository({ prisma: delegate });
		const input = customer();
		const created = await repository.create(input);

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			data: {
				id: "customer-1",
				companyId: "company-1",
				name: "Maria Gonzalez",
				email: "maria@example.com",
				phone: "+54 11 5555-1234",
				address: "Av. Siempre Viva 742",
				createdAt: input.createdAt,
				updatedAt: input.updatedAt,
			},
		});
		expect(created).toBeInstanceOf(Customer);
		expect(created.email).toBe("maria@example.com");
	});

	it("never writes the soft-delete stamp on create", async () => {
		const { delegate, create } = buildFakeDelegate();
		create.mockResolvedValue(row());

		const repository = new PrismaCustomerRepository({ prisma: delegate });
		await repository.create(customer());

		expect(create.mock.calls[0][0].data).not.toHaveProperty("deletedAt");
	});

	it("lets any other failure through untouched", async () => {
		const { delegate, create } = buildFakeDelegate();
		const failure = Object.assign(new Error("connection lost"), {
			code: "P1001",
		});
		create.mockRejectedValue(failure);

		const repository = new PrismaCustomerRepository({ prisma: delegate });

		await expect(repository.create(customer())).rejects.toBe(failure);
	});
});

describe("PrismaCustomerRepository.findActiveById", () => {
	it("filters by company, id and deletedAt: null", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(row());

		const repository = new PrismaCustomerRepository({ prisma: delegate });
		const found = await repository.findActiveById("company-1", "customer-1");

		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "customer-1", companyId: "company-1", deletedAt: null },
		});
		expect(found).toBeInstanceOf(Customer);
		expect(found?.id).toBe("customer-1");
	});

	it("returns null when no active row matches", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(null);

		const repository = new PrismaCustomerRepository({ prisma: delegate });

		await expect(
			repository.findActiveById("company-1", "customer-1"),
		).resolves.toBeNull();
	});
});

describe("PrismaCustomerRepository.list", () => {
	it("lists the company's active customers ordered by name and then id", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([row()]);

		const repository = new PrismaCustomerRepository({ prisma: delegate });
		const listed = await repository.list("company-1");

		expect(findMany).toHaveBeenCalledWith({
			where: { companyId: "company-1", deletedAt: null },
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});
		expect(listed).toHaveLength(1);
	});

	it("matches the search against the name, the email or the phone, case-insensitively", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([]);

		const repository = new PrismaCustomerRepository({ prisma: delegate });
		await repository.list("company-1", "maria");

		expect(findMany).toHaveBeenCalledWith({
			where: {
				companyId: "company-1",
				deletedAt: null,
				OR: [
					{ name: { contains: "maria", mode: "insensitive" } },
					{ email: { contains: "maria", mode: "insensitive" } },
					{ phone: { contains: "maria", mode: "insensitive" } },
				],
			},
			orderBy: [{ name: "asc" }, { id: "asc" }],
		});
	});
});

describe("PrismaCustomerRepository.update", () => {
	it("guards the write on deletedAt: null and re-reads the row", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(row({ name: "Maria G." }));

		const repository = new PrismaCustomerRepository({ prisma: delegate });
		const updated = customer().withChanges({ name: "Maria G." });
		const result = await repository.update(updated);

		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "customer-1", companyId: "company-1", deletedAt: null },
			data: {
				name: "Maria G.",
				email: "maria@example.com",
				phone: "+54 11 5555-1234",
				address: "Av. Siempre Viva 742",
				updatedAt: updated.updatedAt,
			},
		});
		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "customer-1", companyId: "company-1", deletedAt: null },
		});
		expect(result?.name).toBe("Maria G.");
	});

	it("returns null when the guarded write matches no active row", async () => {
		const { delegate, updateMany } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 0 });

		const repository = new PrismaCustomerRepository({ prisma: delegate });

		await expect(
			repository.update(customer().withChanges({ name: "Maria G." })),
		).resolves.toBeNull();
	});

	it("never writes the soft-delete stamp from an update", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(row());

		const repository = new PrismaCustomerRepository({ prisma: delegate });
		await repository.update(customer().withChanges({ phone: null }));

		expect(updateMany.mock.calls[0][0].data).not.toHaveProperty("deletedAt");
	});
});

describe("PrismaCustomerRepository.softDelete", () => {
	it("stamps the given instant instead of deleting the row", async () => {
		const { delegate, updateMany, findFirst } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		findFirst.mockResolvedValue(row({ deletedAt: DELETED_AT }));

		const repository = new PrismaCustomerRepository({ prisma: delegate });
		const deleted = await repository.softDelete(
			"company-1",
			"customer-1",
			DELETED_AT,
		);

		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "customer-1", companyId: "company-1", deletedAt: null },
			data: { deletedAt: DELETED_AT, updatedAt: DELETED_AT },
		});
		expect(deleted?.deletedAt).toBe(DELETED_AT);
	});

	it("returns null when the customer was already deleted or is foreign", async () => {
		const { delegate, updateMany } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 0 });

		const repository = new PrismaCustomerRepository({ prisma: delegate });

		await expect(
			repository.softDelete("company-1", "customer-1", DELETED_AT),
		).resolves.toBeNull();
	});
});
