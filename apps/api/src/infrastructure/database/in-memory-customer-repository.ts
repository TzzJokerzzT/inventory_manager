import { Customer } from "../../domain/entities/customer.js";
import type { CustomerRepository } from "../../domain/repositories/customer-repository.js";

/**
 * In-memory adapter for the {@link CustomerRepository} port.
 *
 * It mirrors the Prisma adapter's rules -- `deletedAt: null` on every active
 * read, company scoping inside the query, the same deterministic order and the
 * same case-insensitive search -- so the two stay interchangeable behind the
 * port.
 *
 * There is no uniqueness check because the port has no unique rule: the
 * database has no unique index on the email (L4).
 */
export class InMemoryCustomerRepository implements CustomerRepository {
	private readonly customers: Map<string, Customer>;

	constructor(customers: Customer[] = []) {
		this.customers = new Map<string, Customer>();

		for (const customer of customers) {
			this.customers.set(customer.id, customer);
		}
	}

	async create(customer: Customer): Promise<Customer> {
		this.customers.set(customer.id, customer);

		return customer;
	}

	async findActiveById(
		companyId: string,
		customerId: string,
	): Promise<Customer | null> {
		const customer = this.customers.get(customerId);

		// Same two conditions the Prisma adapter puts in the WHERE clause: the
		// company and the soft-delete stamp are part of the query, so a
		// soft-deleted customer and a foreign one answer the same `null`.
		if (
			customer === undefined ||
			customer.companyId !== companyId ||
			customer.deletedAt !== null
		) {
			return null;
		}

		return customer;
	}

	async findByIds(companyId: string, ids: string[]): Promise<Customer[]> {
		// No `deletedAt` filter on purpose: this is the history read of the
		// stock movements, so a movement of a deleted customer must stay
		// readable (MOV-05). The company filter stays, so a deleted customer of
		// another company never resolves.
		const wanted = new Set(ids);

		return Array.from(this.customers.values()).filter(
			(row) => row.companyId === companyId && wanted.has(row.id),
		);
	}

	async list(companyId: string, search?: string): Promise<Customer[]> {
		const needle = search?.trim().toLowerCase();

		return Array.from(this.customers.values())
			.filter((row) => row.companyId === companyId && row.deletedAt === null)
			.filter(
				(row) =>
					needle === undefined ||
					needle.length === 0 ||
					row.name.toLowerCase().includes(needle) ||
					(row.email?.toLowerCase().includes(needle) ?? false) ||
					(row.phone?.toLowerCase().includes(needle) ?? false),
			)
			.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
	}

	async update(customer: Customer): Promise<Customer | null> {
		const existing = this.customers.get(customer.id);

		// The guarded write: an absent, foreign or already-deleted row is not
		// updated, exactly like `where: { ..., deletedAt: null }`.
		if (
			existing === undefined ||
			existing.companyId !== customer.companyId ||
			existing.deletedAt !== null
		) {
			return null;
		}

		// The entity is immutable, so the update replaces the row under the same
		// id.
		this.customers.set(customer.id, customer);

		return customer;
	}

	async softDelete(
		companyId: string,
		customerId: string,
		deletedAt: Date,
	): Promise<Customer | null> {
		const existing = this.customers.get(customerId);

		if (
			existing === undefined ||
			existing.companyId !== companyId ||
			existing.deletedAt !== null
		) {
			return null;
		}

		const deleted = Customer.create({
			id: existing.id,
			companyId: existing.companyId,
			name: existing.name,
			email: existing.email,
			phone: existing.phone,
			address: existing.address,
			deletedAt,
			createdAt: existing.createdAt,
			updatedAt: deletedAt,
		});

		// The row stays: the stock movements of CLI-04 must keep pointing at a
		// readable customer.
		this.customers.set(deleted.id, deleted);

		return deleted;
	}

	/** Adapter-specific: lets the test suite insert customers directly. */
	save(customer: Customer): void {
		this.customers.set(customer.id, customer);
	}
}
