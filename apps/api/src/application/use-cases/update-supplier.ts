import type { MembershipRole } from "../../domain/entities/membership.js";
import type { Supplier } from "../../domain/entities/supplier.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { SupplierNotFoundError } from "../../domain/errors/supplier-not-found-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { SupplierRepository } from "../../domain/repositories/supplier-repository.js";

export interface UpdateSupplierInput {
	supplierId: string;
	/** Absent means "unchanged"; an explicit `null` clears the contact. */
	name?: string;
	contact?: string | null;
}

export interface UpdateSupplierContext {
	companyId: string;
	actorRole: MembershipRole;
}

export interface UpdateSupplierDependencies {
	supplierRepository: SupplierRepository;
}

/**
 * Use case for the partial update of a supplier (S4, the "M" of the ABM).
 *
 * The update is **partial**: an absent field is `undefined` and keeps its
 * value, while an explicit `null` -- or an empty/whitespace-only string, which
 * the entity normalizes the same way -- clears `contact`. That is why the merge
 * inside the entity uses `undefined` checks and not `??`: `null` is a value
 * here, not a missing one.
 *
 * The order mirrors the create case: role first (`manage_products`), then the
 * supplier must exist in this company and be active, then the merged state is
 * re-validated by the entity, then the guarded write. A rename onto a name the
 * company already uses -- deleted rows included, keeping its own name is not a
 * conflict -- is answered by the repository with
 * {@link SupplierNameAlreadyExistsError} and mapped to 409.
 *
 * A guarded write that matched no active row means the supplier was soft-deleted
 * between the read and the write, which is reported as the same 404 instead of a
 * successful update.
 */
export class UpdateSupplierUseCase {
	private readonly supplierRepository: SupplierRepository;

	constructor(dependencies: UpdateSupplierDependencies) {
		this.supplierRepository = dependencies.supplierRepository;
	}

	async execute(
		input: UpdateSupplierInput,
		context: UpdateSupplierContext,
	): Promise<Supplier> {
		if (!can(context.actorRole, "manage_products")) {
			throw new InsufficientRoleError();
		}

		const current = await this.supplierRepository.findById(
			context.companyId,
			input.supplierId,
		);

		if (current === null) {
			throw new SupplierNotFoundError();
		}

		const updated = current.withChanges({
			name: input.name,
			contact: input.contact,
		});

		const stored = await this.supplierRepository.update(updated);

		// Fail-closed: the guarded write refuses when the row was soft-deleted
		// between the read and the write, so a delete racing this update is not
		// reported as a successful update.
		if (stored === null) {
			throw new SupplierNotFoundError();
		}

		return stored;
	}
}
