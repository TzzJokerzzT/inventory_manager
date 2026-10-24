import type { MembershipRole } from "../../domain/entities/membership.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { SupplierNotFoundError } from "../../domain/errors/supplier-not-found-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { SupplierRepository } from "../../domain/repositories/supplier-repository.js";

export interface DeleteSupplierInput {
	supplierId: string;
}

export interface DeleteSupplierContext {
	companyId: string;
	actorRole: MembershipRole;
}

export interface DeleteSupplierDependencies {
	supplierRepository: SupplierRepository;
}

/**
 * Use case for the soft delete of a supplier (S4: "baja lógica").
 *
 * The row is never removed: `deletedAt` is stamped so the supplier disappears
 * from the roster and from every active read, while the row itself stays
 * available for the purchase lots that reference it (S6) and keeps its name
 * reserved (the unique index covers deleted rows). The endpoint answers `204`,
 * so nothing is returned.
 *
 * A second `DELETE`, a supplier of another company and a nonexistent one all
 * answer the same {@link SupplierNotFoundError}: the resource already left the
 * roster, and which of the three it was is not the caller's business (EMP-03).
 */
export class DeleteSupplierUseCase {
	private readonly supplierRepository: SupplierRepository;

	constructor(dependencies: DeleteSupplierDependencies) {
		this.supplierRepository = dependencies.supplierRepository;
	}

	async execute(
		input: DeleteSupplierInput,
		context: DeleteSupplierContext,
	): Promise<void> {
		// The role is checked before the write, so a MEMBER never reaches the
		// supplier catalogue at all.
		if (!can(context.actorRole, "manage_products")) {
			throw new InsufficientRoleError();
		}

		const deleted = await this.supplierRepository.softDelete(
			context.companyId,
			input.supplierId,
			new Date(),
		);

		if (deleted === null) {
			throw new SupplierNotFoundError();
		}
	}
}
