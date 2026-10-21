import type { Customer } from "../../domain/entities/customer.js";
import { CustomerNotFoundError } from "../../domain/errors/customer-not-found-error.js";
import type { CustomerRepository } from "../../domain/repositories/customer-repository.js";

export interface GetCustomerInput {
	customerId: string;
}

export interface GetCustomerContext {
	/** The company whose roster is being read. */
	companyId: string;
}

export interface GetCustomerDependencies {
	customerRepository: CustomerRepository;
}

/**
 * Use case for reading one customer (S7).
 *
 * A customer of another company, a soft-deleted one and a nonexistent one all
 * answer the same {@link CustomerNotFoundError}: the lookup filters by
 * `companyId` and `deletedAt: null`, so the endpoint cannot be used to probe
 * other companies' customer ids (S5).
 *
 * Reading needs no role: the company context already proved an ACTIVE
 * membership.
 */
export class GetCustomerUseCase {
	private readonly customerRepository: CustomerRepository;

	constructor(dependencies: GetCustomerDependencies) {
		this.customerRepository = dependencies.customerRepository;
	}

	async execute(
		input: GetCustomerInput,
		context: GetCustomerContext,
	): Promise<Customer> {
		const customer = await this.customerRepository.findActiveById(
			context.companyId,
			input.customerId,
		);

		if (customer === null) {
			throw new CustomerNotFoundError();
		}

		return customer;
	}
}
