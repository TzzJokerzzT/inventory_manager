import { CreateCustomerUseCase } from "../src/application/use-cases/create-customer.js";
import { DeleteCustomerUseCase } from "../src/application/use-cases/delete-customer.js";
import { GetCustomerUseCase } from "../src/application/use-cases/get-customer.js";
import { ListCustomersUseCase } from "../src/application/use-cases/list-customers.js";
import { UpdateCustomerUseCase } from "../src/application/use-cases/update-customer.js";
import { Customer } from "../src/domain/entities/customer.js";
import type { MembershipRole } from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { StockMovement } from "../src/domain/entities/stock-movement.js";
import { CustomerNotFoundError } from "../src/domain/errors/customer-not-found-error.js";
import { DomainError } from "../src/domain/errors/domain-error.js";
import { InMemoryCustomerRepository } from "../src/infrastructure/database/in-memory-customer-repository.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";

interface SeedInput {
	id: string;
	companyId?: string;
	name?: string;
	email?: string | null;
	phone?: string | null;
	address?: string | null;
	deleted?: boolean;
}

function seed(
	repository: InMemoryCustomerRepository,
	input: SeedInput,
): Customer {
	const customer = Customer.create({
		id: input.id,
		companyId: input.companyId ?? COMPANY,
		name: input.name ?? `Customer ${input.id}`,
		email: input.email ?? null,
		phone: input.phone ?? null,
		address: input.address ?? null,
		deletedAt: input.deleted ? new Date("2026-10-22T12:00:00.000Z") : null,
	});

	repository.save(customer);

	return customer;
}

function repository(): InMemoryCustomerRepository {
	return new InMemoryCustomerRepository();
}

function context(actorRole: MembershipRole = "MEMBER") {
	return { companyId: COMPANY, actorRole };
}

describe("CreateCustomerUseCase", () => {
	function createCustomer(repository_: InMemoryCustomerRepository) {
		return new CreateCustomerUseCase({ customerRepository: repository_ });
	}

	it.each<MembershipRole>(["OWNER", "ADMIN", "MEMBER"])(
		"creates the customer as a %s, because every ACTIVE membership writes",
		async (actorRole) => {
			// S6/L2: "Todos los roles activos escriben clientes". The company
			// context already proved the membership, so there is no role rule.
			const created = await createCustomer(repository()).execute(
				{
					name: "  Maria Gonzalez  ",
					email: "  Maria.Gonzalez@Example.COM ",
					phone: " +54 11 5555-1234 ",
					address: " Av. Siempre Viva 742 ",
				},
				context(actorRole),
			);

			expect(created).toMatchObject({
				companyId: COMPANY,
				name: "Maria Gonzalez",
				email: "maria.gonzalez@example.com",
				phone: "+54 11 5555-1234",
				address: "Av. Siempre Viva 742",
			});
		},
	);

	it("persists it in the repository", async () => {
		const repository_ = repository();

		const created = await createCustomer(repository_).execute(
			{ name: "Maria Gonzalez" },
			context("OWNER"),
		);

		await expect(repository_.findActiveById(COMPANY, created.id)).resolves.toBe(
			created,
		);
	});

	it("stores a customer without contact fields", async () => {
		const created = await createCustomer(repository()).execute(
			{ name: "Maria Gonzalez", email: "  ", phone: "", address: null },
			context("MEMBER"),
		);

		expect(created.email).toBeNull();
		expect(created.phone).toBeNull();
		expect(created.address).toBeNull();
	});

	it("accepts two customers of the company with the same email", async () => {
		// L4: the schema has no unique index on the email, so there is no
		// uniqueness rule to enforce.
		const repository_ = repository();
		const useCase = createCustomer(repository_);

		await useCase.execute(
			{ name: "Maria", email: "maria@example.com" },
			context("OWNER"),
		);

		await expect(
			useCase.execute(
				{ name: "Maria II", email: "MARIA@example.com" },
				context("OWNER"),
			),
		).resolves.toMatchObject({ email: "maria@example.com" });
	});

	it("rejects an invalid body with a domain error", async () => {
		const useCase = createCustomer(repository());

		await expect(
			useCase.execute({ name: "   " }, context("OWNER")),
		).rejects.toThrow(DomainError);
		await expect(
			useCase.execute(
				{ name: "Maria", email: "not-an-email" },
				context("OWNER"),
			),
		).rejects.toThrow(DomainError);
	});
});

describe("ListCustomersUseCase", () => {
	function listCustomers(repository_: InMemoryCustomerRepository) {
		return new ListCustomersUseCase({ customerRepository: repository_ });
	}

	it("lists the company's active customers ordered by name and then id", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-2", name: "Zoe" });
		seed(repository_, { id: "customer-1", name: "Ana" });
		seed(repository_, { id: "customer-3", name: "Ana" });

		const listed = await listCustomers(repository_).execute(
			{},
			{ companyId: COMPANY },
		);

		expect(listed.map((row) => row.id)).toEqual([
			"customer-1",
			"customer-3",
			"customer-2",
		]);
	});

	it("searches by name, case-insensitively", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1", name: "Maria Gonzalez" });
		seed(repository_, { id: "customer-2", name: "Juan Perez" });

		const listed = await listCustomers(repository_).execute(
			{ search: "  MARIA " },
			{ companyId: COMPANY },
		);

		expect(listed.map((row) => row.id)).toEqual(["customer-1"]);
	});

	it("searches by email, case-insensitively", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "customer-1",
			name: "Maria",
			email: "maria@example.com",
		});
		seed(repository_, {
			id: "customer-2",
			name: "Juan",
			email: "juan@other.com",
		});

		const listed = await listCustomers(repository_).execute(
			{ search: "EXAMPLE.COM" },
			{ companyId: COMPANY },
		);

		expect(listed.map((row) => row.id)).toEqual(["customer-1"]);
	});

	it("searches by phone", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "customer-1",
			name: "Maria",
			phone: "+54 11 5555-1234",
		});
		seed(repository_, {
			id: "customer-2",
			name: "Juan",
			phone: "+54 11 4444-0000",
		});

		const listed = await listCustomers(repository_).execute(
			{ search: "5555" },
			{ companyId: COMPANY },
		);

		expect(listed.map((row) => row.id)).toEqual(["customer-1"]);
	});

	it("treats an empty search as no filter", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1" });
		seed(repository_, { id: "customer-2" });

		const listed = await listCustomers(repository_).execute(
			{ search: "   " },
			{ companyId: COMPANY },
		);

		expect(listed).toHaveLength(2);
	});

	it("never lists a soft-deleted customer nor another company's", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1", deleted: true });
		seed(repository_, { id: "customer-2", companyId: OTHER_COMPANY });

		await expect(
			listCustomers(repository_).execute({}, { companyId: COMPANY }),
		).resolves.toEqual([]);
	});
});

describe("GetCustomerUseCase", () => {
	function getCustomer(repository_: InMemoryCustomerRepository) {
		return new GetCustomerUseCase({ customerRepository: repository_ });
	}

	it("returns the customer of the company", async () => {
		const repository_ = repository();
		const customer = seed(repository_, { id: "customer-1" });

		await expect(
			getCustomer(repository_).execute(
				{ customerId: "customer-1" },
				{ companyId: COMPANY },
			),
		).resolves.toBe(customer);
	});

	it("answers CustomerNotFoundError for another company's customer", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1", companyId: OTHER_COMPANY });

		await expect(
			getCustomer(repository_).execute(
				{ customerId: "customer-1" },
				{ companyId: COMPANY },
			),
		).rejects.toThrow(CustomerNotFoundError);
	});

	it("answers CustomerNotFoundError for a soft-deleted customer", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1", deleted: true });

		await expect(
			getCustomer(repository_).execute(
				{ customerId: "customer-1" },
				{ companyId: COMPANY },
			),
		).rejects.toThrow(CustomerNotFoundError);
	});

	it("answers CustomerNotFoundError for a customer that does not exist", async () => {
		await expect(
			getCustomer(repository()).execute(
				{ customerId: "customer-nope" },
				{ companyId: COMPANY },
			),
		).rejects.toThrow(CustomerNotFoundError);
	});
});

describe("UpdateCustomerUseCase", () => {
	function updateCustomer(repository_: InMemoryCustomerRepository) {
		return new UpdateCustomerUseCase({ customerRepository: repository_ });
	}

	it("updates the given fields and preserves the untouched ones", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "customer-1",
			name: "Maria Gonzalez",
			email: "maria@example.com",
			phone: "+54 11 5555-1234",
			address: "Av. Siempre Viva 742",
		});

		const updated = await updateCustomer(repository_).execute(
			{ customerId: "customer-1", name: "  Maria G.  " },
			context("OWNER"),
		);

		expect(updated).toMatchObject({
			id: "customer-1",
			companyId: COMPANY,
			name: "Maria G.",
			email: "maria@example.com",
			phone: "+54 11 5555-1234",
			address: "Av. Siempre Viva 742",
		});
	});

	it("lowercases a new email and trims the contact fields", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1" });

		const updated = await updateCustomer(repository_).execute(
			{
				customerId: "customer-1",
				email: "  Maria@Example.COM ",
				phone: " +54 11 5555-1234 ",
				address: " Av. Siempre Viva 742 ",
			},
			context("OWNER"),
		);

		expect(updated.email).toBe("maria@example.com");
		expect(updated.phone).toBe("+54 11 5555-1234");
		expect(updated.address).toBe("Av. Siempre Viva 742");
	});

	it("clears a contact field when null is sent explicitly", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "customer-1",
			email: "maria@example.com",
			phone: "+54 11 5555-1234",
			address: "Av. Siempre Viva 742",
		});

		const updated = await updateCustomer(repository_).execute(
			{ customerId: "customer-1", email: null, phone: null, address: null },
			context("OWNER"),
		);

		expect(updated.email).toBeNull();
		expect(updated.phone).toBeNull();
		expect(updated.address).toBeNull();
	});

	it("clears a contact field when an empty string is sent", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "customer-1",
			email: "maria@example.com",
			phone: "+54 11 5555-1234",
			address: "Av. Siempre Viva 742",
		});

		const updated = await updateCustomer(repository_).execute(
			{ customerId: "customer-1", email: "   ", address: "" },
			context("OWNER"),
		);

		expect(updated.email).toBeNull();
		expect(updated.address).toBeNull();
	});

	it("lets every active role update, the MEMBER included", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1" });

		await expect(
			updateCustomer(repository_).execute(
				{ customerId: "customer-1", name: "Maria G." },
				context("MEMBER"),
			),
		).resolves.toMatchObject({ name: "Maria G." });
	});

	it("answers CustomerNotFoundError for a soft-deleted customer", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1", deleted: true });

		await expect(
			updateCustomer(repository_).execute(
				{ customerId: "customer-1", name: "Maria G." },
				context("OWNER"),
			),
		).rejects.toThrow(CustomerNotFoundError);
	});

	it("answers CustomerNotFoundError for another company's customer", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1", companyId: OTHER_COMPANY });

		await expect(
			updateCustomer(repository_).execute(
				{ customerId: "customer-1", name: "Maria G." },
				context("OWNER"),
			),
		).rejects.toThrow(CustomerNotFoundError);
	});

	it("re-validates the patched fields", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1" });

		await expect(
			updateCustomer(repository_).execute(
				{ customerId: "customer-1", email: "not-an-email" },
				context("OWNER"),
			),
		).rejects.toThrow(DomainError);
	});
});

describe("DeleteCustomerUseCase", () => {
	function deleteCustomer(repository_: InMemoryCustomerRepository) {
		return new DeleteCustomerUseCase({ customerRepository: repository_ });
	}

	it("soft-deletes the customer, which then disappears from every read", async () => {
		const repository_ = repository();
		const customer = seed(repository_, { id: "customer-1" });

		await expect(
			deleteCustomer(repository_).execute(
				{ customerId: "customer-1" },
				context("OWNER"),
			),
		).resolves.toBeUndefined();

		await expect(
			repository_.findActiveById(COMPANY, "customer-1"),
		).resolves.toBeNull();
		// The row survives, with the identifier the stock movements will point at.
		expect(customer.id).toBe("customer-1");
	});

	it("lets every active role delete, the MEMBER included", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1" });

		await expect(
			deleteCustomer(repository_).execute(
				{ customerId: "customer-1" },
				context("MEMBER"),
			),
		).resolves.toBeUndefined();
	});

	it("answers CustomerNotFoundError on a second delete", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1" });

		const useCase = deleteCustomer(repository_);
		await useCase.execute({ customerId: "customer-1" }, context("OWNER"));

		await expect(
			useCase.execute({ customerId: "customer-1" }, context("OWNER")),
		).rejects.toThrow(CustomerNotFoundError);
	});

	it("answers CustomerNotFoundError for another company's customer", async () => {
		const repository_ = repository();
		seed(repository_, { id: "customer-1", companyId: OTHER_COMPANY });

		await expect(
			deleteCustomer(repository_).execute(
				{ customerId: "customer-1" },
				context("OWNER"),
			),
		).rejects.toThrow(CustomerNotFoundError);
	});

	it("never touches the stock nor the movements", async () => {
		// L3/CLI-04: a customer is not associated with stock exits yet, so
		// deleting one must leave the ledger untouched.
		const store = new Map<string, Product>();
		const productRepository = new InMemoryProductRepository([], store);
		const movementRepository = new InMemoryStockMovementRepository(store);
		const customerRepository = repository();

		const product = await productRepository.create(
			Product.create({
				id: "product-1",
				companyId: COMPANY,
				name: "Cafe",
				sku: "CAF-500",
				price: "1500",
				stockQuantity: 10,
			}),
		);
		movementRepository.save(
			StockMovement.create({
				id: "movement-1",
				companyId: COMPANY,
				productId: product.id,
				type: "IN",
				quantity: 10,
				userId: "user-1",
			}),
		);
		seed(customerRepository, { id: "customer-1" });

		await deleteCustomer(customerRepository).execute(
			{ customerId: "customer-1" },
			context("MEMBER"),
		);

		await expect(
			productRepository.findActiveById(COMPANY, "product-1"),
		).resolves.toMatchObject({ stockQuantity: 10 });
		await expect(
			movementRepository.findByCompany(COMPANY, { limit: 10 }),
		).resolves.toHaveLength(1);
	});
});
