import type { Customer } from "../../domain/entities/customer.js";
import type { MembershipRole } from "../../domain/entities/membership.js";
import { CustomerNotFoundError } from "../../domain/errors/customer-not-found-error.js";
import type { CustomerRepository } from "../../domain/repositories/customer-repository.js";

export interface UpdateCustomerInput {
	customerId: string;
	/** Absent means "unchanged"; an explicit `null` clears the field. */
	name?: string;
	email?: string | null;
	phone?: string | null;
	address?: string | null;
}

export interface UpdateCustomerContext {
	companyId: string;
	/**
	 * Carried so a caller passes the exact same context to every customer use
	 * case, but **never read**: any ACTIVE membership edits a customer
	 * (S6/L2), which `requireCompanyContext` already proved.
	 */
	actorRole: MembershipRole;
}

export interface UpdateCustomerDependencies {
	customerRepository: CustomerRepository;
}

/**
 * Use case for the partial update of a customer (CLI-02/S2, S7).
 *
 * The update is **partial**: an absent field is `undefined` and keeps its
 * value, while an explicit `null` -- or an empty/whitespace-only string, which
 * the entity normalizes the same way -- clears `email`, `phone` or `address`.
 * That is why the merge inside the entity uses `undefined` checks and not
 * `??`: `null` is a value here, not a missing one.
 *
 * The order is: the customer must exist in this company and be active
 * (S3/S5), then the merged state is re-validated by the entity, and only then
 * does the guarded write happen. A guarded write that matched no active row
 * means the customer was soft-deleted between the read and the write, which is
 * reported as the same 404 instead of a successful update.
 */
export class UpdateCustomerUseCase {
	private readonly customerRepository: CustomerRepository;

	constructor(dependencies: UpdateCustomerDependencies) {
		this.customerRepository = dependencies.customerRepository;
	}

	async execute(
		input: UpdateCustomerInput,
		context: UpdateCustomerContext,
	): Promise<Customer> {
		const current = await this.customerRepository.findActiveById(
			context.companyId,
			input.customerId,
		);

		if (current === null) {
			throw new CustomerNotFoundError();
		}

		const updated = current.withChanges({
			name: input.name,
			email: input.email,
			phone: input.phone,
			address: input.address,
		});

		const stored = await this.customerRepository.update(updated);

		// Fail-closed: the guarded write refuses when the row was soft-deleted
		// between the read and the write, so a delete racing this update is not
		// reported as a successful update.
		if (stored === null) {
			throw new CustomerNotFoundError();
		}

		return stored;
	}
}
