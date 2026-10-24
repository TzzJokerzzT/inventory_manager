import type { MembershipRole } from "../../domain/entities/membership.js";
import { Supplier } from "../../domain/entities/supplier.js";
import { InsufficientRoleError } from "../../domain/errors/insufficient-role-error.js";
import { can } from "../../domain/policies/authorization.js";
import type { SupplierRepository } from "../../domain/repositories/supplier-repository.js";

export interface CreateSupplierInput {
	name: string;
	/** Free text; blank means "no contact" and is stored as `null`. */
	contact?: string | null;
}

export interface CreateSupplierContext {
	/** The company the supplier belongs to; it comes from the resolved context. */
	companyId: string;
	actorRole: MembershipRole;
}

export interface CreateSupplierDependencies {
	supplierRepository: SupplierRepository;
}

/**
 * Use case for creating a supplier (S4: "entidad proveedor con ABM").
 *
 * The order of the rules is part of the contract:
 *
 * 1. **`manage_products` first** -- writing the supplier catalogue is the same
 *    permission as writing the product catalogue (OWNER and ADMIN write, MEMBER
 *    reads). A MEMBER must never learn whether a body is valid, so the role is
 *    checked before the entity validates anything.
 * 2. **The body is validated by the entity**, not here: one place decides what
 *    a valid supplier is, so a value that reaches the adapter is already
 *    normalized (trimmed name, blank contact as `null`).
 * 3. **The name must be free in this company, deleted rows included** -- the
 *    repository answers {@link SupplierNameAlreadyExistsError}, which the HTTP
 *    layer maps to 409. The read is not repeated here: the unique index is the
 *    authority for two concurrent creates, and both adapters translate it to
 *    the same error.
 *
 * Only the fields of this input are accepted, so an unknown body key never
 * reaches the entity.
 */
export class CreateSupplierUseCase {
	private readonly supplierRepository: SupplierRepository;

	constructor(dependencies: CreateSupplierDependencies) {
		this.supplierRepository = dependencies.supplierRepository;
	}

	async execute(
		input: CreateSupplierInput,
		context: CreateSupplierContext,
	): Promise<Supplier> {
		if (!can(context.actorRole, "manage_products")) {
			throw new InsufficientRoleError();
		}

		const supplier = Supplier.create({
			companyId: context.companyId,
			name: input.name,
			contact: input.contact,
		});

		return this.supplierRepository.create(supplier);
	}
}
