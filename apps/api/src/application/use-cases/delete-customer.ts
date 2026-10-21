import type { MembershipRole } from "../../domain/entities/membership.js";
import { CustomerNotFoundError } from "../../domain/errors/customer-not-found-error.js";
import type { CustomerRepository } from "../../domain/repositories/customer-repository.js";

export interface DeleteCustomerInput {
	customerId: string;
}

export interface DeleteCustomerContext {
	companyId: string;
	/**
	 * Carried so a caller passes the exact same context to every customer use
	 * case, but **never read**: any ACTIVE membership soft-deletes a customer
	 * (S6/L2), which `requireCompanyContext` already proved.
	 */
	actorRole: MembershipRole;
}

export interface DeleteCustomerDependencies {
	customerRepository: CustomerRepository;
}

/**
 * Use case for the soft delete of a customer (CLI-03/S3).
 *
 * The row is never removed: `deletedAt` is stamped so the customer disappears
 * from the roster and from every read, while the row itself stays available
 * for the stock movements that will point at it (CLI-04, out of scope today).
 * The endpoint answers `204`, so nothing is returned.
 *
 * A second `DELETE`, a customer of another company and a nonexistent one all
 * answer the same {@link CustomerNotFoundError}: the resource already left the
 * roster, and which of the three it was is not the caller's business (S5).
 */
export class DeleteCustomerUseCase {
	private readonly customerRepository: CustomerRepository;

	constructor(dependencies: DeleteCustomerDependencies) {
		this.customerRepository = dependencies.customerRepository;
	}

	async execute(
		input: DeleteCustomerInput,
		context: DeleteCustomerContext,
	): Promise<void> {
		const deleted = await this.customerRepository.softDelete(
			context.companyId,
			input.customerId,
			new Date(),
		);

		if (deleted === null) {
			throw new CustomerNotFoundError();
		}
	}
}
