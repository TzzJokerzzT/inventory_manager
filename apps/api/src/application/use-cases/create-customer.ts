import { Customer } from "../../domain/entities/customer.js";
import type { MembershipRole } from "../../domain/entities/membership.js";
import type { CustomerRepository } from "../../domain/repositories/customer-repository.js";

export interface CreateCustomerInput {
	name: string;
	email?: string | null;
	phone?: string | null;
	address?: string | null;
}

export interface CreateCustomerContext {
	/** The company the roster belongs to; it comes from the resolved context. */
	companyId: string;
	/**
	 * Carried so a caller passes the exact same context to every customer use
	 * case, but **never read**: the rule is "any ACTIVE membership writes"
	 * (S6/L2), which `requireCompanyContext` already proved before this runs.
	 * There is deliberately no row in the authorization matrix for customers.
	 */
	actorRole: MembershipRole;
}

export interface CreateCustomerDependencies {
	customerRepository: CustomerRepository;
}

/**
 * Use case for creating a customer (MI-11, CLI-01/S1).
 *
 * There is **no role check** on purpose: every ACTIVE membership creates
 * customers (S6/L2), and the company context is the guard. The body is
 * validated by the entity, not here, so a value that reaches the adapter is
 * already normalized (trimmed name, lowercased email, blank contacts as
 * `null`).
 *
 * Only the fields of this input are accepted, so an unknown body key never
 * reaches the entity.
 */
export class CreateCustomerUseCase {
	private readonly customerRepository: CustomerRepository;

	constructor(dependencies: CreateCustomerDependencies) {
		this.customerRepository = dependencies.customerRepository;
	}

	async execute(
		input: CreateCustomerInput,
		context: CreateCustomerContext,
	): Promise<Customer> {
		const customer = Customer.create({
			companyId: context.companyId,
			name: input.name,
			email: input.email,
			phone: input.phone,
			address: input.address,
		});

		return this.customerRepository.create(customer);
	}
}
