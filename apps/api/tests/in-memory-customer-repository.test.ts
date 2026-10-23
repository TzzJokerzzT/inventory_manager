import { Customer } from "../src/domain/entities/customer.js";
import { InMemoryCustomerRepository } from "../src/infrastructure/database/in-memory-customer-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";
const DELETED_AT = new Date("2026-10-22T12:00:00.000Z");

function customer(
	overrides: Partial<Parameters<typeof Customer.create>[0]> = {},
): Customer {
	return Customer.create({
		id: "customer-1",
		companyId: COMPANY,
		name: "Maria Gonzalez",
		...overrides,
	});
}

function repositoryWith(customers: Customer[]): InMemoryCustomerRepository {
	return new InMemoryCustomerRepository(customers);
}

describe("InMemoryCustomerRepository.create", () => {
	it("stores exactly the entity it was given and returns it", async () => {
		const repository = repositoryWith([]);
		const created = customer();

		await expect(repository.create(created)).resolves.toBe(created);
		await expect(
			repository.findActiveById(COMPANY, "customer-1"),
		).resolves.toBe(created);
	});

	it("accepts two customers of the same company with the same email", async () => {
		// L4: no unique index on the email, so no uniqueness rule here either.
		const repository = repositoryWith([
			customer({ email: "maria@example.com" }),
		]);

		await expect(
			repository.create(
				customer({
					id: "customer-2",
					name: "Maria II",
					email: "maria@example.com",
				}),
			),
		).resolves.toMatchObject({ email: "maria@example.com" });
	});
});

describe("InMemoryCustomerRepository.findActiveById", () => {
	it("returns the customer of the company", async () => {
		const stored = customer();
		const repository = repositoryWith([stored]);

		await expect(
			repository.findActiveById(COMPANY, "customer-1"),
		).resolves.toBe(stored);
	});

	it("returns null for another company's customer", async () => {
		const repository = repositoryWith([customer({ companyId: OTHER_COMPANY })]);

		await expect(
			repository.findActiveById(COMPANY, "customer-1"),
		).resolves.toBeNull();
	});

	it("returns null for a soft-deleted customer", async () => {
		const repository = repositoryWith([customer({ deletedAt: DELETED_AT })]);

		await expect(
			repository.findActiveById(COMPANY, "customer-1"),
		).resolves.toBeNull();
	});
});

describe("InMemoryCustomerRepository.findByIds", () => {
	it("returns the company's customers for the given ids, soft-deleted ones included", async () => {
		const active = customer();
		const deleted = customer({ id: "customer-2", deletedAt: DELETED_AT });
		const repository = repositoryWith([active, deleted]);

		const found = await repository.findByIds(COMPANY, [
			"customer-1",
			"customer-2",
		]);

		expect(found.map((row) => row.id).sort()).toEqual([
			"customer-1",
			"customer-2",
		]);
	});

	it("never returns another company's customer", async () => {
		const repository = repositoryWith([
			customer({ id: "customer-2", companyId: OTHER_COMPANY }),
		]);

		await expect(
			repository.findByIds(COMPANY, ["customer-2"]),
		).resolves.toEqual([]);
	});

	it("returns an empty list when asked for no ids", async () => {
		const repository = repositoryWith([customer()]);

		await expect(repository.findByIds(COMPANY, [])).resolves.toEqual([]);
	});

	it("omits the ids the company does not have", async () => {
		const repository = repositoryWith([customer()]);

		const found = await repository.findByIds(COMPANY, ["customer-1", "ghost"]);

		expect(found.map((row) => row.id)).toEqual(["customer-1"]);
	});
});

describe("InMemoryCustomerRepository.list", () => {
	it("returns only the company's active customers, ordered by name then id", async () => {
		const repository = repositoryWith([
			customer({ id: "customer-b", name: "Zoe" }),
			customer({ id: "customer-a", name: "Ana" }),
			customer({ id: "customer-c", name: "Ana" }),
			customer({ id: "customer-d", name: "Deleted", deletedAt: DELETED_AT }),
			customer({ id: "customer-e", companyId: OTHER_COMPANY, name: "Ajeno" }),
		]);

		const listed = await repository.list(COMPANY);

		expect(listed.map((row) => row.id)).toEqual([
			"customer-a",
			"customer-c",
			"customer-b",
		]);
	});

	it("matches the search against the name, the email or the phone, case-insensitively", async () => {
		const repository = repositoryWith([
			customer({
				id: "customer-1",
				name: "Maria Gonzalez",
				email: "maria@example.com",
				phone: "+54 11 5555-1234",
			}),
			customer({
				id: "customer-2",
				name: "Juan Perez",
				email: "juan@other.com",
			}),
			customer({ id: "customer-3", name: "Ana Diaz", phone: "5555-0000" }),
		]);

		const byName = await repository.list(COMPANY, "MARIA");
		const byEmail = await repository.list(COMPANY, "Example.COM");
		const byPhone = await repository.list(COMPANY, "5555");

		expect(byName.map((row) => row.id)).toEqual(["customer-1"]);
		expect(byEmail.map((row) => row.id)).toEqual(["customer-1"]);
		// Ordered by name: "Ana Diaz" comes before "Maria Gonzalez".
		expect(byPhone.map((row) => row.id)).toEqual(["customer-3", "customer-1"]);
	});

	it("never matches a null contact field against the search", async () => {
		const repository = repositoryWith([
			customer({ id: "customer-1", email: null, phone: null }),
		]);

		await expect(repository.list(COMPANY, "example.com")).resolves.toEqual([]);
		await expect(repository.list(COMPANY, "5555")).resolves.toEqual([]);
	});

	it("returns an empty list for a company with no customers", async () => {
		await expect(repositoryWith([]).list(COMPANY)).resolves.toEqual([]);
	});
});

describe("InMemoryCustomerRepository.update", () => {
	it("replaces the stored customer and returns the new state", async () => {
		const repository = repositoryWith([customer()]);
		const updated = customer().withChanges({ name: "Maria G." });

		await expect(repository.update(updated)).resolves.toBe(updated);
		await expect(
			repository.findActiveById(COMPANY, "customer-1"),
		).resolves.toMatchObject({ name: "Maria G." });
	});

	it("returns null for a soft-deleted customer", async () => {
		const deleted = customer({ deletedAt: DELETED_AT });
		const repository = repositoryWith([deleted]);

		await expect(
			repository.update(deleted.withChanges({ name: "Maria G." })),
		).resolves.toBeNull();
	});

	it("returns null for another company's customer", async () => {
		const repository = repositoryWith([customer({ companyId: OTHER_COMPANY })]);

		// A write that names a customer of another company under this company's
		// context matches no row: the company is part of the WHERE clause.
		await expect(
			repository.update(customer().withChanges({ name: "Maria G." })),
		).resolves.toBeNull();
	});
});

describe("InMemoryCustomerRepository.softDelete", () => {
	it("stamps deletedAt and keeps the row", async () => {
		const repository = repositoryWith([customer()]);

		const deleted = await repository.softDelete(
			COMPANY,
			"customer-1",
			DELETED_AT,
		);

		expect(deleted?.deletedAt).toBe(DELETED_AT);
		await expect(
			repository.findActiveById(COMPANY, "customer-1"),
		).resolves.toBeNull();
		await expect(repository.list(COMPANY)).resolves.toEqual([]);
	});

	it("returns null on a second delete, because the customer already left the roster", async () => {
		const repository = repositoryWith([customer()]);

		await repository.softDelete(COMPANY, "customer-1", DELETED_AT);

		await expect(
			repository.softDelete(COMPANY, "customer-1", new Date()),
		).resolves.toBeNull();
	});

	it("returns null for another company's customer", async () => {
		const repository = repositoryWith([customer({ companyId: OTHER_COMPANY })]);

		await expect(
			repository.softDelete(COMPANY, "customer-1", DELETED_AT),
		).resolves.toBeNull();
	});
});
