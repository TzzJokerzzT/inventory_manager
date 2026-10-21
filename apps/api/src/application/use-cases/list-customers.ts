import type { Customer } from "../../domain/entities/customer.js";
import type { CustomerRepository } from "../../domain/repositories/customer-repository.js";

export interface ListCustomersInput {
	/** Free text matched against the name, the email or the phone. */
	search?: string;
}

export interface ListCustomersContext {
	/** The company whose roster is being read. */
	companyId: string;
}

export interface ListCustomersDependencies {
	customerRepository: CustomerRepository;
}

/**
 * Use case for listing a company's customers (MI-11, CLI-05/S4).
 *
 * Reading needs **no role**: the company context already proved an ACTIVE
 * membership, and the roster belongs to that company (S6). The scoping is the
 * `companyId` in the query, not a filter here, so a caller can only ever see
 * the customers of a company they belong to.
 *
 * The search is the one CLI-05 asks for: name, email or phone, substring,
 * case-insensitive. Ordering (`name`, then `id`) belongs to the adapter, so
 * both adapters answer the same array for the same state.
 */
export class ListCustomersUseCase {
	private readonly customerRepository: CustomerRepository;

	constructor(dependencies: ListCustomersDependencies) {
		this.customerRepository = dependencies.customerRepository;
	}

	async execute(
		input: ListCustomersInput,
		context: ListCustomersContext,
	): Promise<Customer[]> {
		// A whitespace-only search is "no search", not "match the empty string":
		// the client clearing the box must not hide the roster.
		const search = input.search?.trim();

		return this.customerRepository.list(
			context.companyId,
			search === undefined || search.length === 0 ? undefined : search,
		);
	}
}
